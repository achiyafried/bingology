# Toddler Games Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clips get their own button outside the games screen; the puzzle gets real jigsaw-shaped pieces and six levels (4–20 pieces); the sticker scene uses real character cut-outs instead of circles.

**Architecture:** All changes are in `site/kids/` (plain ESM, pure helpers tested in Node), plus one optional `cutout` flag carried by `kids.json` → `fetch-kids` → `kids-data.json`, and a one-off local Python script that produces transparent PNGs into `site/kids/chars/`.

**Tech Stack:** Node 22 (`node:test`), browser ESM, inline SVG (`clipPath` + `image`), Python 3 + `rembg` (local tool only, not in CI).

**Spec:** `docs/superpowers/specs/2026-11-24-bingology-toddler-puzzle-levels-design.md` (builds on `2026-11-22-bingology-toddler-games-design.md`)

## Global Constraints
- Games and clips exist only for age `small`; `gameRouteFor` keeps guarding every `#play…` route.
- No text the child must read; every button has a Hebrew `aria-label`; data strings through `esc`, images through `safeImg` (TMDB) or a fixed local path `chars/<integer tmdb>.png`.
- State fields in `site/kids/app.js` are taken: `st.puzzle` (daily game), `st.jig`, `st.mem`, `st.scn`, `st.clip`. Don't rename.
- Levels exactly: 4 → 2×2, 6 → 3×2, 9 → 3×3, 12 → 4×3, 16 → 4×4, 20 → 5×4 (cols×rows). Snap radius stays 0.35 × cell width.
- localStorage: new key `bingology:kids-puzzle-size` (one of the six sizes, default 4). Every access in try/catch. The puzzle no longer reads or bumps `bingology:kids-level:puzzle` (memory keeps its level).
- Static import strings in `site/kids/` (deploy stamp test).
- `prefers-reduced-motion`: no animations except the snap.
- Commit with `git -c user.name="achiya fried" -c user.email="achiyafried@achiyas-MacBook-Pro.local" commit`, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only your files.

## Review Focus
1. **A saved puzzle size that isn't one of the six** (`7`, `"x"`, storage throws) → falls back to 4. → Task 2 test.
2. **A route with a size that isn't one of the six** (`#play/puzzle/82728/7`) → shows the level picker for that series, never a broken board. → Task 2 test.
3. **Jigsaw edges must match**: a tab on one piece is exactly a blank on its neighbour, so the solved picture has no gaps or overlaps. → Task 3 test (shared edge parameters are mirrored).
4. **A series flagged `cutout` whose PNG is missing** (404) → the sticker falls back to the circle instead of an empty box. → Task 4 test of the markup (`onerror` swap or a CSS fallback background).
5. **Old saved scenes** (from round 1) still render with cut-outs. → Task 4 test (loadScene shape unchanged).

---

### Task 1: Clips get their own button

**Files:** Modify `site/kids/view.js` (headerHTML), `site/kids/play.js` (homeHTML, backHash), `site/kids/kids.css` if needed. Test: `tests/kids-play.test.mjs`, `tests/kids-view.test.mjs`.

**Interfaces:** `headerHTML(age, { hasClips })` adds `<button class="k-gamebtn k-clipbtn" data-a="clips">📺 קליפים</button>` only when `age === "small" && hasClips`. `app.js` passes `hasClips: withClips(st.items).length > 0` and handles `data-a="clips"` → `location.hash = "play/clips"`. `homeHTML` no longer has a clips tile. `backHash({game:"clips", arg:null})` → `""` (the kids grid); with an arg → `#play/clips` (unchanged).

- [ ] Step 1: failing tests: header has `data-a="clips"` for small+hasClips, not for mid or without clips; `homeHTML` never contains `clips`; `backHash` clips without arg → `""`.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npm test` → pass. Step 5: commit `feat(kids): clips get their own button`.

### Task 2: Puzzle levels and routes

**Files:** Modify `site/kids/puzzle.js`, `site/kids/play.js` (parseRoute, backHash), `site/kids/store.js`, `site/kids/app.js`, `site/kids/kids.css`. Test: `tests/kids-puzzle.test.mjs`, `tests/kids-play.test.mjs`, `tests/kids-game.test.mjs` (store).

**Interfaces:**
- `LEVELS = [{n:4,cols:2,rows:2},{n:6,cols:3,rows:2},{n:9,cols:3,rows:3},{n:12,cols:4,rows:3},{n:16,cols:4,rows:4},{n:20,cols:5,rows:4}]`; `levelFor(n) → level|null`.
- `initPuzzle(tmdb, n, rnd = Math.random)` (n = piece count; replaces the `level` argument and the old `grid(level)`), state gains `n`.
- `parseRoute` returns `{ game, arg, sub }`: `#play/puzzle/82728/9` → `{game:"puzzle", arg:"82728", sub:"9"}`; other routes `sub: null`.
- `backHash`: puzzle with arg and sub → `#play/puzzle/<arg>`; puzzle with arg only → `#play/puzzle`; others unchanged.
- `levelsHTML(item, current) → string`: six big buttons `data-a="go" data-v="puzzle/<tmdb>/<n>"`, each drawing its grid (cols×rows small squares, CSS grid), `aria-label="פאזל של <n> חלקים"`, `aria-pressed="true"` on `current`. The series poster small at the top.
- `store.js`: `loadPuzzleSize(storage) → 4|6|9|12|16|20` (default 4), `savePuzzleSize(storage, n)`.
- `app.js` puzzleView: no arg → `pickerHTML`; arg without a valid sub → `levelsHTML(item, loadPuzzleSize(store))`; valid sub → `savePuzzleSize`, (re)create `st.jig` when tmdb or n differ, `puzzleHTML`. "🔁" picks another series at the same n (`#play/puzzle/<tmdb>/<n>`). Remove `bumpLevel(store,"puzzle")` and `loadLevel(store,"puzzle")`.
- Tray piece width scales with the board: piece width % = 100 / cols of the tray container width at board scale (keep pieces the same size as board cells).

- [ ] Step 1: failing tests: `levelFor` for all six and `7` → null; `initPuzzle(1, 20)` has 20 pieces, cols 5 rows 4; parseRoute/backHash cases above incl. `#play/puzzle/82728/7` → `sub:"7"` and the view falls back to levels (test `levelsHTML` is used when `levelFor(Number(sub))` is null via a pure `puzzleScreen(route, items, size) → "picker"|"levels"|"board"` helper in puzzle.js); `levelsHTML` has 6 buttons with Hebrew labels and the current pressed; store size fallback for `7`, `"x"`, throwing storage.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npm test` → pass. Step 5: commit `feat(kids): puzzle levels from 4 to 20 pieces`.

### Task 3: Jigsaw-shaped pieces

**Files:** Modify `site/kids/puzzle.js`, `site/kids/app.js` (drag reads the piece element; snap unchanged), `site/kids/kids.css`. Test: `tests/kids-puzzle.test.mjs`.

**Interfaces:**
- Board coordinates: the image is `1600×900`; cell `cw = 1600/cols`, `ch = 900/rows`; tab margin `m = 0.25 × min(cw, ch)`.
- `edges(cols, rows, rnd) → { h: number[][], v: number[][] }`: `h[r][c]` for the horizontal edge below cell (c,r) (rows-1 rows), `v[r][c]` for the vertical edge right of (c,r) (cols-1 cols); each `+1` (tab out of the upper/left piece) or `-1`. Stored in the puzzle state so re-renders keep shapes; seeded from `initPuzzle`'s `rnd`.
- `piecePath(c, r, state) → string`: an SVG path in board coordinates for cell (c,r), clockwise, straight on the frame, a classic rounded tab (cubic Béziers, tab neck ≈ 1/3 of the edge, tab height ≈ m) on inner edges, direction from `edges` — the neighbour uses the same edge value mirrored, so shapes interlock exactly.
- `pieceSVG(p, state, src) → string`: `<svg viewBox="x0-m y0-m cw+2m ch+2m">` with a `<clipPath id="pz-<p>">` of `piecePath`, an `<image href=src x=0 y=0 width=1600 height=900 clip-path=url(#pz-<p>)>`, and a thin stroke of the same path for edge contrast. Tray pieces render `pieceSVG` inside `.k-pz-piece` sized `(cw+2m)/1600` of the board width; the board draws placed pieces in one overlay `<svg viewBox="0 0 1600 900">` using the same paths. Use unique ids per board render (prefix with tmdb).
- The piece element's centre is the cell centre (margins are symmetric), so `trySnap` and the drop math stay as they are.

- [ ] Step 1: failing tests: `edges(4,3,seeded)` sizes (h: 2×4, v: 3×3) with values ±1; `piecePath` for a corner cell has straight segments on its two frame edges (no `C` commands on those sides — test by checking the path of a 1×1 puzzle has no curves) and, for two neighbours, the shared edge is the mirror (tab vs blank: assert the curve's control points are reflected across the edge line); `pieceSVG` uses `safeImg` (non-TMDB src → no `<image>`), unique clip ids.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npm test` → pass. Step 5: commit `feat(kids): jigsaw-shaped puzzle pieces`.

### Task 4: Character cut-outs in the sticker scene (code)

**Files:** Modify `scripts/lib/kids.mjs` (validateKids: `cutout` must be `true` if present), `scripts/fetch-kids.mjs` / `kidsLive` caller (copy `cutout: true` to the item), `site/kids/scene.js`, `site/kids/kids.css`; Create `scripts/cut-characters.py`. Test: `tests/kids-file.test.mjs`, `tests/kids-fetch.test.mjs`, `tests/kids-scene.test.mjs`.

**Interfaces:**
- `scene.js`: stickers of items with `cutout === true` render as `<img class="k-cut …" src="chars/<Number(tmdb)>.png" alt="" draggable="false" data-tmdb="<id>">` (keeping the same `data-i` / role / aria-label the circle has), 96px tall on the scene and 72px in the tray, width auto. Without `cutout`: the circle as today. No inline JS: `app.js` adds one delegated `error` listener (capture phase) on the root that replaces a failed `.k-cut` with the circle markup for that item (a pure `circleHTML(item, …)` exported from scene.js).
- `scripts/cut-characters.py <kids-data.json> <tmdb,...> <outdir>`: for each id, download the backdrop, crop a square around the sticker (side = 3.2 × r × H), run `rembg` `isnet-general-use` with `providers=["CPUExecutionProvider"]`, alpha cleanup (alpha < 40 → 0, else min(255, alpha × 1.5)), crop to bbox, resize to 256px on the longer side, save `<outdir>/<tmdb>.png`; print the size. Document the venv setup and `MODEL_CHECKSUM_DISABLED=1` in a header comment. Not run by tests or CI.
- `kids.json`: `cutout: true` on rows that get a PNG (Task 5).

- [ ] Step 1: failing tests: validateKids rejects `cutout: 1` / `"yes"`; fetch-kids copies `cutout: true`; `sceneHTML` with a cutout item renders `<img … src="chars/<id>.png">` in the tray and on the scene and the circle otherwise; the id in the path is an integer.
- [ ] Step 2: run → FAIL. Step 3: implement (incl. the delegated error fallback in app.js). Step 4: `npm test` → pass. Step 5: commit `feat(kids): character cut-outs in the sticker scene`.

### Task 5: Produce and review the cut-outs (controller)

- [ ] Step 1: run `scripts/cut-characters.py` for all 32 small series into `site/kids/chars/`.
- [ ] Step 2: review each on a contact sheet. For bad ones, try another `art.img` / sticker area and re-run; give up → delete the PNG.
- [ ] Step 3: set `cutout: true` in `kids.json` for the kept ones, run `node scripts/fetch-kids.mjs`, `npm test`.
- [ ] Step 4: browser pass (mobile viewport): clips button, levels 4 and 20, jigsaw snapping, cut-outs in a scene, a missing PNG falls back.
- [ ] Step 5: commit `feat(kids): character cut-outs` (PNGs, kids.json, kids-data.json).
