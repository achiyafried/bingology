// Toddler jigsaw: a backdrop cut into 2x2 (later 3x2) pieces. Pure state helpers plus the picker and board markup.
import { esc, safeImg } from "../lib/esc.js";
import { withArt } from "./art.js";

const SNAP = 0.35;

export const grid = level => (level < 3 ? { cols: 2, rows: 2 } : { cols: 3, rows: 2 });

export function initPuzzle(tmdb, level, rnd = Math.random) {
  const { cols, rows } = grid(level), n = cols * rows;
  const tray = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [tray[i], tray[j]] = [tray[j], tray[i]];
  }
  if (n > 1 && tray.every((p, i) => p === i)) tray.push(tray.shift());
  return { tmdb, cols, rows, placed: Array(n).fill(false), tray };
}

/** cx, cy: the piece centre in board pixels. Places the piece when it is close enough to its own cell centre. */
export function trySnap(state, piece, cx, cy, board) {
  const cw = board.w / state.cols, ch = board.h / state.rows;
  const tx = (piece % state.cols + 0.5) * cw, ty = (Math.floor(piece / state.cols) + 0.5) * ch;
  if (state.placed[piece] || Math.hypot(cx - tx, cy - ty) > SNAP * cw) return state;
  const placed = state.placed.slice();
  placed[piece] = true;
  return { ...state, placed };
}

export const solved = state => state.placed.every(Boolean);

export function pickerHTML(items) {
  const tiles = withArt(items).map(x => {
    const src = safeImg(x.poster);
    const img = src ? `<img class="k-poster" src="${src}" alt="" loading="lazy">` : `<span class="k-poster k-noposter" aria-hidden="true">📺</span>`;
    return `<li><button class="k-tile" data-a="go" data-v="puzzle/${Number(x.tmdb)}" aria-label="${esc(x.name || "פאזל")}">${img}</button></li>`;
  });
  return `<ul class="k-grid k-pz-picker">${tiles.join("")}</ul>`;
}

const pct = (i, n) => (n > 1 ? (i / (n - 1)) * 100 : 0);
function sliceStyle(src, state, p) {
  const { cols, rows } = state;
  const bg = src ? `background-image:url(${src});` : "";
  return `${bg}background-size:${cols * 100}% ${rows * 100}%;background-position:${pct(p % cols, cols)}% ${pct(Math.floor(p / cols), rows)}%`;
}

const CONFETTI = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff"];
function confettiHTML() {
  return `<div class="k-confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;background:${CONFETTI[i % 5]};animation-delay:${(i % 6) * 0.15}s"></i>`).join("")}</div>`;
}

export function puzzleHTML(item, state) {
  const src = safeImg(item.backdrop);
  const { cols, rows } = state;
  const cw = 100 / cols, ch = 100 / rows;
  const cells = state.placed.map((on, p) => on
    ? `<div class="k-pz-cell" style="left:${(p % cols) * cw}%;top:${Math.floor(p / cols) * ch}%;width:${cw}%;height:${ch}%;${sliceStyle(src, state, p)}"></div>` : "").join("");
  const ghost = `<div class="k-pz-ghost"${src ? ` style="background-image:url(${src})"` : ""}></div>`;
  const done = solved(state);
  const tray = state.tray.filter(p => !state.placed[p]).map(p =>
    `<div class="k-pz-piece" data-piece="${p}" style="width:${cols === 2 ? 42 : 30}%;aspect-ratio:${(16 / 9) * rows / cols};${sliceStyle(src, state, p)}"></div>`).join("");
  const end = done
    ? `${confettiHTML()}<div class="k-pz-end"><button class="k-pz-btn" data-a="again" aria-label="עוד פעם"><span aria-hidden="true">🔁</span></button><button class="k-pz-btn" data-a="home" aria-label="חזרה"><span aria-hidden="true">🏠</span></button></div>`
    : `<div class="k-pz-tray">${tray}</div>`;
  return `<section class="k-pz"><div class="k-pz-board" data-board>${ghost}${cells}</div>${end}</section>`;
}
