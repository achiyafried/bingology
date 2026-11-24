// 🫧 Bubbles: characters float up inside bubbles; a tap pops them. Pure helpers; app.js spawns and removes the elements.
import { esc } from "../lib/esc.js";
import { circleStyle } from "./scene.js";
import { title } from "./catalog.js";

export const MAX_BUBBLES = 6;
export const SPAWN_MS = 1200;

/** A new bubble: which character, where across, how long it takes to rise (s), and its diameter (px). */
export function pickBubble(items, rnd = Math.random, id = 0) {
  const pool = items.filter(i => i.age === "small" && (i.cutout === true || i.backdrop));
  if (!pool.length) return null;
  const x = pool[Math.floor(rnd() * pool.length)];
  return { id, tmdb: x.tmdb, x: 0.16 + rnd() * 0.68, dur: 8 + rnd() * 4, size: Math.round(80 + rnd() * 30) };
}

/** One bubble button (it rises; its inner span pops); reduced motion rises three times slower. */
export function bubbleHTML(b, item, reduced) {
  const id = Number.isInteger(item.tmdb) && item.cutout === true ? item.tmdb : null;
  const face = id ? `<img src="kids/chars/${id}.png" alt="" draggable="false">` : `<span class="k-bub-face" style="${circleStyle(item)}"></span>`;
  const dur = Math.round(b.dur * (reduced ? 3 : 1) * 10) / 10;
  return `<button class="k-bub" data-a="pop" data-b="${Number(b.id)}" aria-label="${esc(title(item) || "")}" style="left:${Math.round(b.x * 1000) / 10}%;width:${Number(b.size)}px;height:${Number(b.size)}px;animation-duration:${dur}s"><span class="k-bub-in">${face}</span></button>`;
}
