// "ציון בינג׳": one 50–100 score from several sources, each turned into a percentile
// within the app's own list so different scales become comparable.
export const WEIGHTS = { imdb: 0.4, tmdb: 0.2, rt: 0.3, nyt: 0.1 };
const PRIOR_VOTES = 200; // TMDB scores with few votes are pulled toward the list average

/** Percentile of each value among `vals` (0 = lowest, 1 = highest; ties share the middle). */
function percentiles(vals) {
  const nums = vals.filter(v => v != null);
  return vals.map(v => {
    if (v == null) return null;
    if (nums.length === 1) return 1;
    const less = nums.filter(x => x < v).length, same = nums.filter(x => x === v).length;
    return (less + (same - 1) / 2) / (nums.length - 1);
  });
}

/** For each series: { score: 50–100 | null, parts: { source: percentile } } in the same order. */
export function bingeScores(S) {
  const voted = S.filter(s => s.tmdbVote != null && s.tmdbVotes > 0);
  const mean = voted.length ? voted.reduce((a, s) => a + s.tmdbVote, 0) / voted.length : 0;
  const raw = {
    imdb: S.map(s => (typeof s.imdb === "number" ? s.imdb : null)),
    tmdb: S.map(s => (s.tmdbVote != null && s.tmdbVotes > 0 ? (s.tmdbVote * s.tmdbVotes + mean * PRIOR_VOTES) / (s.tmdbVotes + PRIOR_VOTES) : null)),
    rt: S.map(s => (typeof s.rt === "number" ? s.rt : null)),
    nyt: S.map(s => (s.nyt ? 101 - s.nyt : null)),
  };
  const pct = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, percentiles(v)]));
  return S.map((_, i) => {
    const parts = {};
    let sum = 0, w = 0;
    for (const k of Object.keys(WEIGHTS)) {
      const p = pct[k][i];
      if (p == null) continue;
      parts[k] = Math.round(p * 1000) / 1000;
      sum += WEIGHTS[k] * p; w += WEIGHTS[k];
    }
    return { score: w ? Math.round(50 + 50 * sum / w) : null, parts };
  });
}
