// Toddler games shell: hash routes, the games home screen, and the frame (home + mute buttons, TMDB credit).
import { withArt } from "./art.js";

const GAMES = ["puzzle", "memory", "scene", "clips"];

export function parseRoute(hash) {
  const m = /^#play(?:\/([^/]*))?(?:\/([^/]*))?(?:\/(.*))?$/.exec(hash || "");
  if (!m) return { game: null, arg: null, sub: null };
  if (!m[1] || !GAMES.includes(m[1])) return { game: "home", arg: null, sub: null };
  return { game: m[1], arg: m[2] || null, sub: m[3] || null };
}

export function backHash({ game, arg, sub }) {
  if (game === "home" || (game === "clips" && !arg)) return "";
  if (game === "puzzle" && arg && sub) return `#play/puzzle/${arg}`;
  if (arg && (game === "puzzle" || game === "scene" || game === "clips")) return `#play/${game}`;
  return "#play";
}

/** The route for a hash, or null when a #play… hash is opened outside the "small" group (games exist only there). */
export function gameRouteFor(hash, age) {
  const route = parseRoute(hash);
  return route.game && age !== "small" ? null : route;
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
  return `<div class="k-tiles">${tiles.join("")}</div>`;
}
