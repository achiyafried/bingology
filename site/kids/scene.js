// Sticker scenes: pick a place, drag character stickers (cut-outs, else round crops) anywhere, they stay. Pure list helpers plus markup.
import { esc, safeImg } from "../lib/esc.js";
import { withArt, stickerStyle } from "./art.js";
import { SCENES } from "./scenes.js";
import { title } from "./catalog.js";

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

/** The round sticker's style (also the fallback when a cut-out fails to load). */
export function circleStyle(item) {
  return `background-image:url(${safeImg(item.backdrop)});${stickerStyle(item.sticker ?? DEFAULT, STICKER)}`;
}

/** A cut-out PNG in site/kids/chars/ for this series, or null. */
const cutId = item => (item.cutout === true && Number.isInteger(item.tmdb) && item.tmdb > 0 ? item.tmdb : null);

/** One sticker element: the cut-out image when there is one, else the round crop. */
function stickerEl(cls, attrs, item, pos = "") {
  const id = cutId(item), label = `role="img" aria-label="${esc(title(item) || "")}"`;
  return id
    ? `<div class="${cls} k-cut" ${attrs} ${label}${pos ? ` style="${pos}"` : ""}><img class="k-cut-img" src="kids/chars/${id}.png" alt="" draggable="false" data-tmdb="${id}"></div>`
    : `<div class="${cls}" ${attrs} ${label} style="${pos}${circleStyle(item)}"></div>`;
}

/** opts.confirm: show the "clean up?" question instead of the sponge. */
export function sceneHTML(place, list, items, opts = {}) {
  const scene = SCENES.find(s => s.id === place);
  if (!scene) return placesHTML();
  const arts = withArt(items), byId = new Map(arts.map(i => [i.tmdb, i]));
  const placed = list.map((s, i) => {
    const item = byId.get(s.tmdb);
    return item ? stickerEl("k-sc-st", `data-i="${i}"`, item, `left:${s.x * 100}%;top:${s.y * 100}%;`) : "";
  }).join("");
  const tray = arts.map(i => stickerEl("k-sc-tpl", `data-t="${Number(i.tmdb)}"`, i)).join("");
  const clear = opts.confirm
    ? `<span class="k-sc-ask">לנקות?</span><button class="k-sc-btn" data-a="clear-yes" aria-label="כן, לנקות"><span aria-hidden="true">✓</span></button><button class="k-sc-btn" data-a="clear-no" aria-label="לא, להשאיר"><span aria-hidden="true">✕</span></button>`
    : `<button class="k-sc-btn" data-a="clear" aria-label="לנקות את החדר"><span aria-hidden="true">🧽</span></button>`;
  const sils = (opts.targets || []).map(t => {
    const id = Number.isInteger(t.tmdb) ? t.tmdb : null;
    return id ? `<div class="k-sil${t.done ? " k-sil-done" : ""}" style="left:${Math.round(t.x * 1000) / 10}%;top:${Math.round(t.y * 1000) / 10}%" aria-hidden="true"><img src="kids/chars/${id}.png" alt="" draggable="false"></div>` : "";
  }).join("");
  return `<section class="k-sc"><div class="k-sc-scene" data-scene>${scene.svg}${placed}${sils}</div><div class="k-sc-foot"><button class="k-sc-arr" data-a="tray" data-v="-1" aria-label="לדמויות הקודמות"><span aria-hidden="true">›</span></button><div class="k-sc-tray">${tray}</div><button class="k-sc-arr" data-a="tray" data-v="1" aria-label="לדמויות הבאות"><span aria-hidden="true">‹</span></button><div class="k-sc-clear">${clear}</div></div></section>`;
}
