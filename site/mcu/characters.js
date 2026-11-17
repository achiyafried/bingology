// MCU characters: which tab/character the URL asks for, and each character's path along the timeline.
import { ordered } from "./timeline.js";

/** "#chars" → the grid; "#char/<id>" → that character (unknown → the grid); anything else → the timeline. */
export function route(hash, chars) {
  const h = String(hash || "");
  if (h === "#chars") return { tab: "chars", char: null };
  const m = /^#char\/([a-z0-9-]+)$/.exec(h);
  if (m) return { tab: "chars", char: chars.find(c => c.id === m[1]) ?? null };
  return { tab: "timeline", char: null };
}

/** A character's titles among the shown ones, in the chosen order: [{item, as, cameo}]. */
export function charPath(shown, c, order) {
  const apps = new Map(c.apps.map(a => [a.id, a]));
  return ordered(shown.filter(x => apps.has(x.id)), order).map(item => ({ item, as: apps.get(item.id).as, cameo: !!apps.get(item.id).cameo }));
}

export const charProgress = (path, seen) => ({ done: path.filter(p => seen.has(p.item.id)).length, total: path.length });

/** Grid rows: each character with how many of its shown titles there are and how many are seen. */
export function charRows(chars, shown, seen) {
  const ids = new Set(shown.map(x => x.id));
  return chars.map(c => {
    const apps = c.apps.filter(a => ids.has(a.id));
    return { c, total: apps.length, done: apps.filter(a => seen.has(a.id)).length };
  }).filter(r => r.total > 0);
}
