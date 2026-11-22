// Official clips for toddlers: the picker, the clip list, our own player box and end screen, and the player-message logic.
import { esc, safeImg, safeThumb } from "../lib/esc.js";
import { embedUrl, validKey, YT_ORIGINS, ytErrorCode } from "../lib/trailer.js";
import { stickerStyle } from "./art.js";

const STICKER = 72, DEFAULT = { x: 0.5, y: 0.5, r: 0.3 };

/** The `info` of an {"event":"onStateChange","info":n} message (string or object), else null. */
export function ytState(data) {
  let m = data;
  if (typeof m === "string") { try { m = JSON.parse(m); } catch { return null; } }
  return m && m.event === "onStateChange" && m.info != null && Number.isFinite(Number(m.info)) ? Number(m.info) : null;
}

/** Small items with at least one clip whose id is valid; their clips are narrowed to the valid ones. */
export function withClips(items) {
  return items
    .filter(i => i.age === "small")
    .map(i => ({ ...i, clips: Array.isArray(i.clips) ? i.clips.filter(c => c && validKey(c.id)) : [] }))
    .filter(i => i.clips.length);
}

export const nextIndex = (clips, i) => (i + 1) % clips.length;

/** What a window message means for the current player: "ended", "error", or null (wrong source/origin, other event). */
export function onPlayerMessage(data, origin, source, current) {
  if (!current || source !== current || !YT_ORIGINS.includes(origin)) return null;
  if (ytState(data) === 0) return "ended";
  if (ytErrorCode(data) !== null) return "error";
  return null;
}

export function clipsPickerHTML(items) {
  const tiles = withClips(items).map(i => {
    const img = safeImg(i.backdrop), th = safeThumb(i.clips[0].thumb);
    const bg = img ? `background-image:url(${img});${stickerStyle(i.sticker ?? DEFAULT, STICKER)}`
      : th ? `background-image:url(${th});background-size:cover;background-position:center` : "";
    return `<li><button class="k-cl-st" data-a="go" data-v="clips/${Number(i.tmdb)}" aria-label="${esc(i.name)}" style="${bg}"></button></li>`;
  }).join("");
  return `<ul class="k-cl-picks">${tiles}</ul>`;
}

export function clipListHTML(item) {
  const cells = item.clips.map((c, i) => {
    const th = safeThumb(c.thumb);
    return `<li><button class="k-cl-th" data-a="clip" data-v="${i}" aria-label="${esc(c.title)}">${th ? `<img src="${th}" alt="" loading="lazy">` : ""}</button></li>`;
  }).join("");
  return `<ul class="k-cl-list">${cells}</ul>`;
}

export function playerBoxHTML(item, i, origin) {
  const c = item.clips[i];
  if (!c || !validKey(c.id)) return "";
  return `<div class="k-player"><iframe src="${embedUrl(c.id, origin)}" title="${esc(c.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

export function endedHTML(item, i) {
  const c = item.clips[i];
  if (!c) return "";
  const th = safeThumb(c.thumb);
  return `<div class="k-player k-ended">${th ? `<img src="${th}" alt="">` : ""}<div class="k-ended-btns">`
    + `<button class="k-end-btn" data-a="clip" data-v="${i}" aria-label="שוב"><span aria-hidden="true">🔁</span></button>`
    + `<button class="k-end-btn" data-a="clip" data-v="${nextIndex(item.clips, i)}" aria-label="הקליפ הבא"><span aria-hidden="true">⏭</span></button></div></div>`;
}

/** The whole clip screen: the player (or end screen) box on top, the thumbnails below. */
export function clipScreenHTML(item, clip, origin) {
  const box = clip.ended ? endedHTML(item, clip.i) : playerBoxHTML(item, clip.i, origin);
  return `<section class="k-cl">${box}${clipListHTML(item)}</section>`;
}
