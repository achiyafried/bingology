// Toddler memory game: pure state (deal / flip / settle / won) and the card grid markup.
import { esc, safeImg } from "../lib/esc.js";
import { stickerStyle } from "./art.js";
import { confettiHTML } from "./puzzle.js";

const sizeFor = n => (n > 6 ? 76 : 96);
const STICKER = { x: 0.5, y: 0.5, r: 0.3 };

export const pairsFor = level => (level < 3 ? 3 : 4);

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
    return `<button class="k-mem-card k-mem-face${c.matched ? " k-mem-done" : ""}"${c.matched ? ' aria-disabled="true"' : ""} data-a="mem-flip" data-v="${i}" aria-label="${esc(it.name || "קלף")}"><span class="k-mem-pic" style="${style}"></span></button>`;
  }).join("");
  const end = won(state)
    ? `${confettiHTML()}<div class="k-pz-end"><button class="k-pz-btn" data-a="mem-again" aria-label="עוד פעם"><span aria-hidden="true">🔁</span></button><button class="k-pz-btn" data-a="home" aria-label="חזרה"><span aria-hidden="true">🏠</span></button></div>`
    : "";
  return `<section class="k-mem"><div class="k-mem-grid" style="--s:${SIZE}px;--c:${state.cards.length > 6 ? 4 : 3}">${cards}</div>${end}</section>`;
}
