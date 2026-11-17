// Trailers played inside the site: a YouTube key (from data.json's "trailer") → a privacy-enhanced embed,
// loaded only after a click. Pure markup helpers, shared by app.js and views/mine.js.
import { esc } from "./esc.js";

const KEY = /^[A-Za-z0-9_-]{11}$/;

/** A YouTube video id we are willing to put in a URL/attribute. */
export const validKey = k => typeof k === "string" && KEY.test(k);

export const embedUrl = k => `https://www.youtube-nocookie.com/embed/${k}?autoplay=1&rel=0&playsinline=1`;

/** A 16:9 player for a valid key ("" otherwise). */
export function playerHTML(k, title) {
  if (!validKey(k)) return "";
  return `<div class="tvid"><iframe src="${embedUrl(k)}" title="טריילר: ${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

const PLAY = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>`;

/** The small ▶ that sits beside a tile (a sibling, never inside the tile button). "" without a trailer. */
export function tilePlayHTML(s, i) {
  if (!validKey(s.tr)) return "";
  return `<button class="tplay" data-a="play" data-i="${i}" aria-label="טריילר: ${esc(s.n)}">${PLAY}</button>`;
}

/** The card/ticket row: a button that turns into the player in place. Null without a trailer (caller keeps its fallback). */
export function trailBtnHTML(s, i) {
  if (!validKey(s.tr)) return null;
  return `<div class="trail"><button class="tbtn" data-a="trail" data-i="${i}">${PLAY}צפייה בטריילר</button></div>`;
}
