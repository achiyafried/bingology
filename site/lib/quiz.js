/** The quiz questions to ask for this data: skip "which services" when no series has streaming info. */
export function quizSteps(qs, S) {
  const anyProviders = S.some(s => s.providers && s.providers.length);
  return anyProviders ? qs : qs.filter(q => q.id !== "platforms");
}

/** Back to the home page with a clean quiz. "Already watched" marks are kept on purpose. */
export function resetQuiz(st, blank) {
  Object.assign(st, { tab: "pick", screen: "intro", step: 0, ans: blank, touched: {}, ranked: [], idx: 0, chosen: false, surprise: false });
}

const TOP = 10;

/**
 * Final order of the recommendations. "match" keeps the ranking; "old"/"new" sort the best
 * matches by premiere year, "score" by binge score (unknown years last) so a weak match never jumps to the front.
 * "Best" = the top 10 plus everyone tied with the 10th, so ties are not cut at random.
 */
export function orderResults(ranked, S, mode) {
  if (!["old", "new", "score"].includes(mode)) return ranked;
  const key = mode === "score" ? i => S[i].bs : i => S[i].y;
  const dir = mode === "old" ? 1 : -1;
  const cut = ranked[Math.min(TOP, ranked.length) - 1]?.pct;
  const n = cut == null ? Math.min(TOP, ranked.length) : Math.max(Math.min(TOP, ranked.length), ranked.filter(r => r.pct >= cut).length);
  const top = ranked.slice(0, n).sort((a, b) => {
    const ya = key(a.i), yb = key(b.i);
    if (ya == null || yb == null) return (ya == null) - (yb == null);
    return dir * (ya - yb) || b.sc - a.sc;
  });
  return top.concat(ranked.slice(n));
}
