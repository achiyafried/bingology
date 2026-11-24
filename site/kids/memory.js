// Toddler memory game: pure state (deal / flip / settle / won) and the card grid markup.
import { esc, safeImg } from "../lib/esc.js";
import { stickerStyle } from "./art.js";
import { title } from "./catalog.js";
import { confettiHTML } from "./puzzle.js";
import { withArt } from "./art.js";

const STICKER = { x: 0.5, y: 0.5, r: 0.3 };

/** Card counts the child can pick, with how many columns their grid has. */
export const MEM_LEVELS = [
  { n: 4, cols: 2 }, { n: 6, cols: 3 }, { n: 8, cols: 4 }, { n: 12, cols: 4 }, { n: 16, cols: 4 }, { n: 20, cols: 5 },
];
export const memLevelFor = n => MEM_LEVELS.find(l => l.n === n) ?? null;
const GAP = 8, PHONE = 328; // px between cards; usable width of a 360px phone
/** Square card size so the level's columns fit a phone, at most 96px. */
const sizeFor = n => {
  const cols = (memLevelFor(n) ?? { cols: n > 6 ? 4 : 3 }).cols;
  return Math.min(96, Math.floor((PHONE - (cols - 1) * GAP) / cols));
};
const colsFor = n => (memLevelFor(n) ?? { cols: n > 6 ? 4 : 3 }).cols;

/** Which memory screen a route shows: the level picker, or the board for a valid size there are enough series for. */
export function memoryScreen(route, items) {
  const l = memLevelFor(Number(route.arg));
  return l && withArt(items).length >= l.n / 2 ? "board" : "levels";
}

/** The level buttons there are enough series for, each drawing its grid; `current` (a card count) is pressed. */
export function memLevelsHTML(current, items) {
  const series = withArt(items).length;
  const btns = MEM_LEVELS.filter(l => l.n / 2 <= series).map(l =>
    `<button class="k-lv" data-a="go" data-v="memory/${l.n}" aria-label="זיכרון עם ${l.n} קלפים" aria-pressed="${l.n === current}"><span class="k-lv-grid k-lv-sq" style="grid-template-columns:repeat(${l.cols},1fr)" aria-hidden="true">${"<i></i>".repeat(l.n)}</span></button>`).join("");
  return `<section class="k-lvs"><div class="k-lv-list">${btns}</div></section>`;
}

function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function deal(items, pairs, rnd = Math.random) {
  const chosen = shuffle(items, rnd).slice(0, pairs);
  const cards = shuffle(chosen.flatMap(i => [i.tmdb, i.tmdb]), rnd).map(tmdb => ({ tmdb, open: false, matched: false }));
  return { cards, busy: false };
}

export function flip(state, i) {
  const c = state.cards[i];
  if (state.busy || !c || c.open || c.matched) return state;
  const cards = state.cards.map((x, k) => (k === i ? { ...x, open: true } : x));
  const openIdx = cards.flatMap((x, k) => (x.open && !x.matched ? [k] : []));
  if (openIdx.length < 2) return { ...state, cards };
  const [a, b] = openIdx;
  if (cards[a].tmdb === cards[b].tmdb) {
    return { ...state, cards: cards.map((x, k) => (k === a || k === b ? { ...x, matched: true } : x)) };
  }
  return { cards, busy: true };
}

export const settle = state => ({
  cards: state.cards.map(c => (c.open && !c.matched ? { ...c, open: false } : c)),
  busy: false,
});

export const won = state => state.cards.length > 0 && state.cards.every(c => c.matched);

export function memoryHTML(state, items) {
  const SIZE = sizeFor(state.cards.length);
  const byId = new Map(items.map(i => [i.tmdb, i]));
  const cards = state.cards.map((c, i) => {
    if (!(c.open || c.matched)) {
      return `<button class="k-mem-card k-mem-back" data-a="mem-flip" data-v="${i}" aria-label="קלף"><span aria-hidden="true">❓</span></button>`;
    }
    const it = byId.get(c.tmdb) || {};
    const src = safeImg(it.backdrop);
    const style = `${src ? `background-image:url(${src});` : ""}${stickerStyle(it.sticker || STICKER, SIZE)}`;
    return `<button class="k-mem-card k-mem-face${c.matched ? " k-mem-done" : ""}"${c.matched ? ' aria-disabled="true"' : ""} data-a="mem-flip" data-v="${i}" aria-label="${esc((it.name && title(it)) || "קלף")}"><span class="k-mem-pic" style="${style}"></span></button>`;
  }).join("");
  const end = won(state)
    ? `${confettiHTML()}<div class="k-pz-end"><button class="k-pz-btn" data-a="mem-again" aria-label="עוד פעם"><span aria-hidden="true">🔁</span></button><button class="k-pz-btn" data-a="home" aria-label="חזרה"><span aria-hidden="true">🏠</span></button></div>`
    : "";
  return `<section class="k-mem"><div class="k-mem-grid" style="--s:${SIZE}px;--c:${colsFor(state.cards.length)}">${cards}</div>${end}</section>`;
}
