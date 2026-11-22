import { safeImg } from "../lib/esc.js";

/**
 * CSS declarations for a `size`-px circle showing the sticker region of a backdrop.
 * Returns ONLY background-size and background-position (no image URL): the caller adds
 * `background-image:url(...)` itself, taking the URL through safeImg.
 * Image height H = size / (2r), width W = H * aspect; the point (x*W, y*H) lands at the circle centre.
 */
export function stickerStyle(sticker, size, aspect = 16 / 9) {
  const { x, y, r } = sticker;
  const h = size / (2 * r), w = h * aspect;
  const px = n => `${+n.toFixed(2)}px`;
  return `background-size:${px(w)} ${px(h)};background-position:${px(size / 2 - x * w)} ${px(size / 2 - y * h)}`;
}

/** Items for the toddler games: only `small` ones that have a TMDB backdrop. */
export const withArt = items => items.filter(i => i.age === "small" && safeImg(i.backdrop));
