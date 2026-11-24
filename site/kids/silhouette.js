// "איפה?" goal: dark silhouettes of random characters to fill by dragging the same character onto them. Pure helpers.
import { withArt } from "./art.js";

export const COUNT = 3;
export const MIN_GAP = 0.28; // smallest horizontal gap between silhouette centres, in scene fractions
// Three slots (left low, middle high, right low) so wide pictures never pile up; each gets a small random nudge.
const SLOTS = [{ x: 0.18, y: 0.7 }, { x: 0.5, y: 0.5 }, { x: 0.82, y: 0.7 }];
const NUDGE = 0.02;
export const FILL = 0.12;    // drop distance that fills, as a share of the scene width

/** Up to COUNT distinct characters that have a cut-out, at random spots spread apart inside the scene. */
export function pickTargets(items, rnd = Math.random) {
  const pool = withArt(items).filter(i => i.cutout === true && Number.isInteger(i.tmdb));
  const chosen = [];
  while (chosen.length < COUNT && pool.length) chosen.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  const slots = SLOTS.slice();
  return chosen.map(c => {
    const slot = slots.splice(Math.floor(rnd() * slots.length), 1)[0];
    return { tmdb: c.tmdb, x: slot.x + (rnd() * 2 - 1) * NUDGE, y: slot.y + (rnd() * 2 - 1) * NUDGE, done: false };
  });
}

/** Fills the silhouette of `tmdb` when (fx, fy) is within FILL of its centre; otherwise returns the same list. */
export function tryFill(targets, tmdb, fx, fy) {
  const i = targets.findIndex(t => t.tmdb === tmdb && !t.done && Math.hypot(t.x - fx, t.y - fy) <= FILL);
  return i < 0 ? targets : targets.map((t, j) => (j === i ? { ...t, done: true } : t));
}

export const allFilled = targets => targets.length > 0 && targets.every(t => t.done);
