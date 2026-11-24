// Toddler jigsaw: a backdrop cut into 4–20 pieces (the child picks the level). Pure state helpers plus the picker, level and board markup.
import { esc, safeImg } from "../lib/esc.js";
import { withArt } from "./art.js";
import { title } from "./catalog.js";

const SNAP = 0.35;

export const LEVELS = [
  { n: 4, cols: 2, rows: 2 }, { n: 6, cols: 3, rows: 2 }, { n: 9, cols: 3, rows: 3 },
  { n: 12, cols: 4, rows: 3 }, { n: 16, cols: 4, rows: 4 }, { n: 20, cols: 5, rows: 4 },
];
/** The level with n pieces (a number), or null. */
export const levelFor = n => LEVELS.find(l => l.n === n) ?? null;

/** n: one of the LEVELS sizes. */
export function initPuzzle(tmdb, n, rnd = Math.random) {
  const { cols, rows } = levelFor(n) ?? LEVELS[0];
  n = cols * rows;
  const tray = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [tray[i], tray[j]] = [tray[j], tray[i]];
  }
  if (n > 1 && tray.every((p, i) => p === i)) tray.push(tray.shift());
  return { tmdb, n, cols, rows, placed: Array(n).fill(false), tray, edges: edges(cols, rows, rnd) };
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

/** The board to show for (tmdb, n): the current game (also while its win screen shows), else a fresh one. */
export function boardFor(cur, tmdb, n, rnd = Math.random) {
  return cur && cur.tmdb === tmdb && cur.n === n ? cur : initPuzzle(tmdb, n, rnd);
}

/** Back on the level screen: a solved game is over (picking the same level starts fresh); a half-done one can resume. */
export const onLevels = cur => (cur && !solved(cur) ? cur : null);

// Jigsaw shapes, in board coordinates (the backdrop is 1600x900).
export const BW = 1600, BH = 900;
const geo = state => {
  const cw = BW / state.cols, ch = BH / state.rows;
  return { cw, ch, m: 0.25 * Math.min(cw, ch) };
};

/** One ±1 per inner edge: h[r][c] is below cell (c,r) (+1: the tab sticks down), v[r][c] is right of it (+1: the tab sticks right). */
export function edges(cols, rows, rnd = Math.random) {
  const side = () => (rnd() < 0.5 ? 1 : -1);
  return {
    h: Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, side)),
    v: Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, side)),
  };
}

// A classic tab along an edge, symmetric around its middle so both neighbours draw the same curve.
// [t along the edge, height as a share of the tab size]; each triple after the first point is one cubic.
const TAB = [[0.36, 0], [0.40, 0], [0.42, 0.25], [0.38, 0.5], [0.33, 0.85], [0.45, 1], [0.5, 1],
  [0.55, 1], [0.67, 0.85], [0.62, 0.5], [0.58, 0.25], [0.60, 0], [0.64, 0]];
const r1 = v => Math.round(v * 10) / 10;

/** Points of one edge from a to b; off = unit offset direction for a positive s (s = ±1 tab side, 0 straight). */
function edgePts(a, b, off, s, m) {
  if (!s) return [a, b];
  const pt = ([t, h]) => [r1(a[0] + (b[0] - a[0]) * t + off[0] * s * m * h), r1(a[1] + (b[1] - a[1]) * t + off[1] * s * m * h)];
  return [a, ...TAB.map(pt), b];
}

/** The four edges of cell (c,r), clockwise; each a point list (2 points = straight).
 *  Every inner edge is computed once in a fixed direction (left→right, top→bottom), so neighbours share it exactly. */
export function pieceEdges(c, r, state) {
  const { cw, ch, m } = geo(state), { h, v } = state.edges;
  const x0 = r1(c * cw), y0 = r1(r * ch), x1 = r1((c + 1) * cw), y1 = r1((r + 1) * ch);
  const across = (y, s) => edgePts([x0, y], [x1, y], [0, 1], s, m); // +s bulges down
  const down = (x, s) => edgePts([x, y0], [x, y1], [1, 0], s, m); // +s bulges right
  return {
    top: across(y0, r === 0 ? 0 : h[r - 1][c]),
    right: down(x1, c === state.cols - 1 ? 0 : v[r][c]),
    bottom: across(y1, r === state.rows - 1 ? 0 : h[r][c]).reverse(),
    left: down(x0, c === 0 ? 0 : v[r][c - 1]).reverse(),
  };
}

const segs = pts => (pts.length === 2 ? ` L${pts[1][0]} ${pts[1][1]}`
  : ` L${pts[1][0]} ${pts[1][1]}` + [0, 1, 2, 3].map(k => ` C${pts.slice(2 + k * 3, 5 + k * 3).map(p => `${p[0]} ${p[1]}`).join(" ")}`).join("") + ` L${pts[14][0]} ${pts[14][1]}`);

/** A closed SVG path for cell (c,r) in board coordinates. */
export function piecePath(c, r, state) {
  const e = pieceEdges(c, r, state);
  return `M${e.top[0][0]} ${e.top[0][1]}${segs(e.top)}${segs(e.right)}${segs(e.bottom)}${segs(e.left)} Z`;
}

const clipId = (state, p) => `pz-${Number(state.tmdb)}-${Number(state.n)}-${p}`;
const clipped = (p, state, src) => {
  const c = p % state.cols, r = Math.floor(p / state.cols), d = piecePath(c, r, state), id = clipId(state, p);
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>`
    + (src ? `<image href="${src}" x="0" y="0" width="${BW}" height="${BH}" preserveAspectRatio="none" clip-path="url(#${id})"/>` : `<path d="${d}" fill="#fff3c9"/>`)
    + `<path d="${d}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3"/>`;
};

/** One piece as an SVG framed around its cell plus the tab margin (so its centre is the cell centre). */
export function pieceSVG(p, state, src) {
  const { cw, ch, m } = geo(state), c = p % state.cols, r = Math.floor(p / state.cols);
  const box = [c * cw - m, r * ch - m, cw + 2 * m, ch + 2 * m].map(r1).join(" ");
  return `<svg viewBox="${box}" width="100%" height="100%" aria-hidden="true">${clipped(p, state, safeImg(src))}</svg>`;
}

/** Which puzzle screen a route shows: the series picker, the level picker, or the board. */
export function puzzleScreen(route, items) {
  const item = route.arg ? withArt(items).find(i => String(i.tmdb) === route.arg) : null;
  if (!item) return "picker";
  return route.sub && levelFor(Number(route.sub)) ? "board" : "levels";
}

/** Six level buttons, each drawing its grid; `current` (a size) is pressed. */
export function levelsHTML(item, current) {
  const id = Number(item.tmdb), src = safeImg(item.poster);
  const btns = LEVELS.map(l => {
    const cells = `<span class="k-lv-grid" style="grid-template-columns:repeat(${l.cols},1fr)" aria-hidden="true">${"<i></i>".repeat(l.n)}</span>`;
    return `<button class="k-lv" data-a="go" data-v="puzzle/${id}/${l.n}" aria-label="פאזל של ${l.n} חלקים" aria-pressed="${l.n === current}">${cells}</button>`;
  }).join("");
  return `<section class="k-lvs">${src ? `<img class="k-lv-poster" src="${src}" alt="">` : ""}<div class="k-lv-list">${btns}</div></section>`;
}

export function pickerHTML(items) {
  const tiles = withArt(items).map(x => {
    const src = safeImg(x.poster);
    const img = src ? `<img class="k-poster" src="${src}" alt="" loading="lazy">` : `<span class="k-poster k-noposter" aria-hidden="true">📺</span>`;
    return `<li><button class="k-tile" data-a="go" data-v="puzzle/${Number(x.tmdb)}" aria-label="${esc(title(x) || "פאזל")}">${img}</button></li>`;
  });
  return `<ul class="k-grid k-pz-picker">${tiles.join("")}</ul>`;
}

const CONFETTI = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff"];
export function confettiHTML() {
  return `<div class="k-confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;background:${CONFETTI[i % 5]};animation-delay:${(i % 6) * 0.15}s"></i>`).join("")}</div>`;
}

export function puzzleHTML(item, state) {
  const src = safeImg(item.backdrop);
  const { cw, ch, m } = geo(state);
  const placed = state.placed.map((on, p) => (on ? clipped(p, state, src) : "")).join("");
  const overlay = `<svg class="k-pz-placed" viewBox="0 0 ${BW} ${BH}" aria-hidden="true">${placed}</svg>`;
  const ghost = `<div class="k-pz-ghost"${src ? ` style="background-image:url(${src})"` : ""}></div>`;
  const done = solved(state);
  const w = r1(0.7 * (cw + 2 * m) / BW * 100), ratio = r1((cw + 2 * m) / (ch + 2 * m) * 1000) / 1000;
  const tray = state.tray.filter(p => !state.placed[p]).map(p =>
    `<div class="k-pz-piece" data-piece="${p}" style="width:${w}%;aspect-ratio:${ratio}">${pieceSVG(p, state, src)}</div>`).join("");
  const end = done
    ? `${confettiHTML()}<div class="k-pz-end"><button class="k-pz-btn" data-a="again" aria-label="עוד פעם"><span aria-hidden="true">🔁</span></button><button class="k-pz-btn" data-a="home" aria-label="חזרה"><span aria-hidden="true">🏠</span></button></div>`
    : `<div class="k-pz-tray">${tray}</div>`;
  return `<section class="k-pz"><div class="k-pz-board" data-board>${ghost}${overlay}</div>${end}</section>`;
}
