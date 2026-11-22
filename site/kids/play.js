// Toddler games shell: hash routes, the games home screen, and the frame (home + mute buttons, TMDB credit).
import { withArt } from "./art.js";

const GAMES = ["puzzle", "memory", "scene", "clips"];

export function parseRoute(hash) {
  const m = /^#play(?:\/([^/]*))?(?:\/(.*))?$/.exec(hash || "");
  if (!m) return { game: null, arg: null };
  if (!m[1]) return { game: "home", arg: null };
  if (!GAMES.includes(m[1])) return { game: "home", arg: null };
  return { game: m[1], arg: m[2] || null };
}

export function backHash({ game, arg }) {
  if (game === "home") return "";
  if (arg && (game === "puzzle" || game === "scene")) return `#play/${game}`;
  return "#play";
}

export function shellHTML(inner, { muted }) {
  return `<div class="k-play"><div class="k-bar">
<button data-a="home" aria-label="חזרה"><span aria-hidden="true">🏠</span></button>
<button data-a="mute" aria-label="${muted ? "הפעלת צליל" : "השתקה"}"><span aria-hidden="true">${muted ? "🔇" : "🔊"}</span></button>
</div>
<div class="k-play-area">${inner}</div></div>
<footer class="k-foot">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>`;
}

export function homeHTML(items) {
  const tile = (v, label, icon) => `<button class="k-gtile" data-a="go" data-v="${v}" aria-label="${label}"><span aria-hidden="true">${icon}</span></button>`;
  const tiles = [tile("puzzle", "פאזל", "🧩")];
  if (withArt(items).length >= 3) tiles.push(tile("memory", "זיכרון", "🃏"));
  tiles.push(tile("scene", "איפה?", "🔍"));
  if (items.some(i => i.age === "small" && i.clips?.length)) tiles.push(tile("clips", "קליפים", "🎬"));
  return `<div class="k-tiles">${tiles.join("")}</div>`;
}
