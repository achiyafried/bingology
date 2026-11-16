/* Series similarity: shared crew, genres, moods, length, language, platforms, era. */
const crewOf = new WeakMap(); // series object -> its crew names (series objects are not changed after load)
export const crew = s => {
  let c = crewOf.get(s);
  if (!c) { c = s.creators.map(x => x.replace(/\s*\(.*\)/, "").replace(/^בהפקת /, "").trim()).filter(Boolean); crewOf.set(s, c); }
  return c;
};

export function similarity(s, o) {
  const g = o.g.filter(x => s.g.includes(x)), m = o.mo.filter(x => s.mo.includes(x));
  const mine = crew(s), shared = crew(o).filter(x => mine.includes(x));
  const sc = (shared.length ? 4 : 0) + 2 * g.length + 1.2 * m.length + (o.h === s.h ? 1 : Math.abs(o.h - s.h) === 1 ? 0.3 : -0.5) + (o.lang === s.lang ? 0.3 : 0) + (o.providers.some(p => s.providers.includes(p)) ? 0.2 : 0) + (Math.abs(o.y - s.y) <= 5 ? 0.3 : 0) + o.imdb / 20;
  return { sc, shared, g, m };
}

/* labels (GENRES) is only needed for the genre text in `why`. */
export function neighbours(S, i, n, skip, labels = {}) {
  const s = S[i];
  return S.map((o, j) => {
    if (j === i || (skip && skip(j))) return null;
    const { sc, shared, g, m } = similarity(s, o);
    const why = shared.length ? `מאותם יוצרים (${shared[0]})` : g.length ? "גם " + g.slice(0, 2).map(x => labels[x] ?? x).join(" ו") + (m.length ? ", באותו מצב רוח" : "") : "באותו מצב רוח";
    return { j, sc, why };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, n);
}
