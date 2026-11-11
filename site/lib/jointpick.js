const BUSY = new Set(["seen", "watching", "dropped"]);

/** The other circle member sharing the most `want` ids with me (ties: first in map order); null if alone. */
export function pickPartner(me, lists) {
  const mine = lists.get(me) || new Map();
  let best = null, bestN = -1;
  for (const [id, rows] of lists) {
    if (id === me) continue;
    let n = 0;
    for (const [tmdbId, status] of rows) if (status === "want" && mine.get(tmdbId) === "want") n++;
    if (n > bestN) { best = id; bestN = n; }
  }
  return best;
}

/** Index in S of the best-scoring series passing `ok`; null scores rank below any score; ties keep the earlier one. */
function best(S, scores, ok) {
  let bi = -1, bs = null;
  S.forEach((s, i) => {
    if (!ok(s.tmdbId)) return;
    const sc = scores[i] && scores[i].score;
    const v = typeof sc === "number" ? sc : null;
    if (bi === -1 || (v !== null && (bs === null || v > bs))) { bi = i; bs = v; }
  });
  return bi === -1 ? null : S[bi].tmdbId;
}

/**
 * Shared: both `members` want it. Fallback: nobody in the whole circle has seen/watching/dropped it.
 * Skipped ids are never returned. Returns null when nothing is left.
 */
export function jointPick(S, scores, lists, members, skipped) {
  const status = (u, id) => (lists.get(u) || new Map()).get(id);
  const shared = best(S, scores, id => !skipped.has(id) && members.every(u => status(u, id) === "want"));
  if (shared !== null) return { tmdbId: shared, mode: "shared" };
  const users = [...lists.keys()];
  const fb = best(S, scores, id => !skipped.has(id) && !users.some(u => BUSY.has(status(u, id))));
  return fb !== null ? { tmdbId: fb, mode: "fallback" } : null;
}
