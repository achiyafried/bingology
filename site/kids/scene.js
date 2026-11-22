// Sticker scenes: pick a place, drag round character stickers anywhere, they stay. Pure list helpers plus markup.
import { esc, safeImg } from "../lib/esc.js";
import { withArt, stickerStyle } from "./art.js";
import { SCENES } from "./scenes.js";

export const STICKER = 72; // px, same in the tray and on the scene
const DEFAULT = { x: 0.5, y: 0.5, r: 0.3 };
const unit = n => Math.min(1, Math.max(0, n));

export const outside = (x, y) => x < 0 || x > 1 || y < 0 || y > 1;
export const addSticker = (list, tmdb, x, y) => [...list, { tmdb, x: unit(x), y: unit(y) }];
export const moveSticker = (list, i, x, y) =>
  Number.isInteger(i) && i >= 0 && i < list.length ? list.map((s, j) => (j === i ? { ...s, x: unit(x), y: unit(y) } : s)) : list;
export const removeSticker = (list, i) => (Number.isInteger(i) && i >= 0 && i < list.length ? list.filter((_, j) => j !== i) : list);

export function placesHTML() {
  const tiles = SCENES.map(s =>
    `<li><button class="k-sc-tile" data-a="go" data-v="scene/${s.id}" aria-label="${esc(s.label)}">${s.svg}</button></li>`);
  return `<ul class="k-sc-places">${tiles.join("")}</ul>`;
}

function face(item, extra) {
  const src = safeImg(item.backdrop);
  return `background-image:url(${src});${stickerStyle(item.sticker ?? DEFAULT, STICKER)}${extra ? `;${extra}` : ""}`;
}

/** opts.confirm: show the "clean up?" question instead of the sponge. */
export function sceneHTML(place, list, items, opts = {}) {
  const scene = SCENES.find(s => s.id === place);
  if (!scene) return placesHTML();
  const arts = withArt(items), byId = new Map(arts.map(i => [i.tmdb, i]));
  const placed = list.map((s, i) => {
    const item = byId.get(s.tmdb);
    return item ? `<div class="k-sc-st" data-i="${i}" role="img" aria-label="${esc(item.name || "")}" style="left:${s.x * 100}%;top:${s.y * 100}%;${face(item)}"></div>` : "";
  }).join("");
  const tray = arts.map(i =>
    `<div class="k-sc-tpl" data-t="${Number(i.tmdb)}" role="img" aria-label="${esc(i.name || "")}" style="${face(i)}"></div>`).join("");
  const clear = opts.confirm
    ? `<span class="k-sc-ask">לנקות?</span><button class="k-sc-btn" data-a="clear-yes" aria-label="כן, לנקות"><span aria-hidden="true">✓</span></button><button class="k-sc-btn" data-a="clear-no" aria-label="לא, להשאיר"><span aria-hidden="true">✕</span></button>`
    : `<button class="k-sc-btn" data-a="clear" aria-label="לנקות את החדר"><span aria-hidden="true">🧽</span></button>`;
  return `<section class="k-sc"><div class="k-sc-scene" data-scene>${scene.svg}${placed}</div><div class="k-sc-foot"><div class="k-sc-tray">${tray}</div><div class="k-sc-clear">${clear}</div></div></section>`;
}
