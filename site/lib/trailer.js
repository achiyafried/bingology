// Trailers played inside the site: a YouTube key (from data.json's "trailer") → a privacy-enhanced embed,
// loaded only after a click. Pure markup helpers, shared by app.js and views/mine.js.
import { esc } from "./esc.js";

const KEY = /^[A-Za-z0-9_-]{11}$/;

/** A YouTube video id we are willing to put in a URL/attribute. */
export const validKey = k => typeof k === "string" && KEY.test(k);

/** Where the player's messages come from. */
export const YT_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

/** The embed URL. With the page's origin, the JS API is on, so the player tells us when it can't play. */
export function embedUrl(k, origin) {
  const api = origin ? `&enablejsapi=1&origin=${encodeURIComponent(origin)}` : "";
  return `https://www.youtube-nocookie.com/embed/${k}?autoplay=1&rel=0&playsinline=1${api}`;
}

/** A 16:9 player for a valid key ("" otherwise). data-i lets an error swap it for the search link. */
export function playerHTML(k, title, i, origin) {
  if (!validKey(k)) return "";
  return `<div class="tvid" data-i="${Number(i)}"><iframe src="${embedUrl(k, origin)}" title="טריילר: ${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

/** The YouTube search row: for a series with no trailer, or one that turned out not to play here. */
export function searchLinkHTML(s) {
  const q = /[\u0590-\u05FF]/.test(s.n) ? s.n + " טריילר רשמי" : s.n + " TV series official trailer";
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  return `<div class="trail"><a href="${url}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>צפייה בטריילר<span class="sr"> (נפתח בלשונית חדשה ביוטיוב)</span></a><button class="linkbtn" data-a="copylink" data-u="${url}">העתקת קישור</button></div>`;
}

/** What replaces a player that YouTube refused to play (blocked here, removed, not embeddable). */
export const unavailableHTML = s => `<div class="tna" role="status"><p>הטריילר לא זמין לצפייה כאן.</p>${searchLinkHTML(s)}</div>`;

/** The error code in a player message ({"event":"onError","info":150}), else null. */
export function ytErrorCode(data) {
  let m = data;
  if (typeof m === "string") { try { m = JSON.parse(m); } catch { return null; } }
  return m && m.event === "onError" && Number.isFinite(Number(m.info)) ? Number(m.info) : null;
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
