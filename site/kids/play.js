// Toddler games shell: hash routes, the games home screen, and the frame (home + mute buttons, TMDB credit).
import { withArt } from "./art.js";

const GAMES = ["puzzle", "memory", "scene", "bubbles", "clips", "who"];

export function parseRoute(hash) {
  const m = /^#play(?:\/([^/]*))?(?:\/([^/]*))?(?:\/(.*))?$/.exec(hash || "");
  if (!m) return { game: null, arg: null, sub: null };
  if (!m[1] || !GAMES.includes(m[1])) return { game: "home", arg: null, sub: null };
  return { game: m[1], arg: m[2] || null, sub: m[3] || null };
}

export function backHash({ game, arg, sub }) {
  if (game === "home" || (game === "clips" && !arg)) return "";
  if (game === "puzzle" && arg && sub) return `#play/puzzle/${arg}`;
  if (arg && (game === "puzzle" || game === "scene" || game === "clips" || game === "memory")) return `#play/${game}`;
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
  // title: the explanation shown on hover; the same sentence goes to screen readers.
  const tile = (v, label, icon, tip) => `<button class="k-gtile" data-a="go" data-v="${v}" title="${tip}" aria-label="${label}: ${tip}"><span class="k-gtile-ico" aria-hidden="true">${icon}</span><span class="k-gtile-name">${label}</span><span class="k-gtile-tip">${tip}</span></button>`;
  const tiles = [tile("puzzle", "פאזל", "🧩", "בונים תמונה מחתיכות פאזל")];
  if (withArt(items).length >= 3) tiles.push(tile("memory", "זיכרון", "🃏", "מוצאים זוגות של דמויות"));
  tiles.push(tile("scene", "איפה?", "🔍", "מוצאים לכל צללית את הדמות שלה"));
  tiles.push(tile("bubbles", "בועות", "🫧", "מפוצצים בועות עם דמויות"));
  return `<div class="k-tiles">${tiles.join("")}</div>`;
}
