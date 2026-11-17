// The home page's moving poster strip: a fresh random pick each visit from the best-scored series.
import { safeImg } from "./esc.js";

/** n distinct indexes into S, drawn with rand() from the `pool` best-scored series that have a real poster. */
export function pickMarquee(S, n = 16, rand = Math.random, pool = 60) {
  const best = S.map((s, i) => i).filter(i => safeImg(S[i].poster))
    .sort((a, b) => (S[b].bs ?? 0) - (S[a].bs ?? 0)).slice(0, pool);
  for (let k = best.length - 1; k > 0; k--) { // Fisher–Yates
    const j = Math.floor(rand() * (k + 1));
    [best[k], best[j]] = [best[j], best[k]];
  }
  return best.slice(0, n);
}
