#!/usr/bin/env python3
"""Cut toddler characters out of their TMDB backdrops into transparent PNGs (one-off, local; not run in CI).

For each series id: download its backdrop (from kids-data.json), crop a square around the sticker spot,
remove the background with rembg's isnet-general-use model, clean the edges, and save a 256px PNG.
Review every result by eye; keep only good ones and set "cutout": true for them in kids.json.

Setup (once, outside the repo):
    python3 -m venv ~/.venvs/rembg && ~/.venvs/rembg/bin/pip install "rembg[cpu]" pillow
Run:
    MODEL_CHECKSUM_DISABLED=1 ~/.venvs/rembg/bin/python -I scripts/cut-characters.py \
        site/kids-data.json 82728,57532 site/kids/chars
MODEL_CHECKSUM_DISABLED skips rembg's network check of the model file. The model runs on the CPU only:
CoreML hangs on recent macOS versions.
"""
import io
import json
import sys
import urllib.request

from PIL import Image
from rembg import new_session, remove

MODEL = "isnet-general-use"
SIZE = 256        # px on the longer side
SPAN = 3.2        # crop side, in sticker radii x image height
FLOOR = 120       # alpha below this is dropped (removes faint "ghosts" of the background)
GAIN = 2.0        # the rest is strengthened
SPECK = 0.04      # opaque islands smaller than this share of the largest one are dropped


def drop_specks(img):
    """Keep only the big opaque parts: 4-connected islands under SPECK x the largest are made transparent."""
    w, h = img.size
    a = img.getchannel("A")
    px = a.load()
    seen = bytearray(w * h)
    islands = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] == 0 or seen[y0 * w + x0]:
                continue
            stack, cells = [(x0, y0)], []
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            islands.append(cells)
    if not islands:
        return img
    big = max(len(c) for c in islands)
    for cells in islands:
        if len(cells) < SPECK * big:
            for x, y in cells:
                px[x, y] = 0
    img.putalpha(a)
    return img


def cut(item, session):
    img = Image.open(io.BytesIO(urllib.request.urlopen(item["backdrop"], timeout=30).read())).convert("RGB")
    w, h = img.size
    st = item.get("sticker") or {"x": 0.5, "y": 0.5, "r": 0.3}
    half = st["r"] * h * SPAN / 2
    box = (max(0, int(st["x"] * w - half)), max(0, int(st["y"] * h - half)),
           min(w, int(st["x"] * w + half)), min(h, int(st["y"] * h + half)))
    out = remove(img.crop(box), session=session)
    out.putalpha(out.getchannel("A").point(lambda v: 0 if v < FLOOR else min(255, int(v * GAIN))))
    out.thumbnail((SIZE * 2, SIZE * 2))
    out = drop_specks(out)
    bbox = out.getbbox()
    if not bbox:
        return None
    out = out.crop(bbox)
    out.thumbnail((SIZE, SIZE))
    return out


def main():
    if len(sys.argv) != 4:
        sys.exit("usage: cut-characters.py <kids-data.json> <tmdb,tmdb,...> <outdir>")
    data = json.load(open(sys.argv[1]))
    ids = {int(x) for x in sys.argv[2].split(",") if x.strip()}
    session = new_session(MODEL, providers=["CPUExecutionProvider"])
    for item in data["items"]:
        if item["tmdb"] not in ids or not item.get("backdrop"):
            continue
        out = cut(item, session)
        if out is None:
            print(item["tmdb"], "empty cut, skipped")
            continue
        out.save(f"{sys.argv[3]}/{item['tmdb']}.png", optimize=True)
        print(item["tmdb"], out.size, flush=True)


if __name__ == "__main__":
    main()
