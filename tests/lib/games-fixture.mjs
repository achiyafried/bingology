// 60 synthetic series in 12 groups of 5 (same creator). Every group shares a hub actor,
// and every pair of groups shares a "link" actor held by one series in each group, so any
// two series are at most 3 actor hops apart (same group: 1, via link: 2 or 3).
const GROUPS = 12;
const GENRES = [["drama"], ["crime", "drama"], ["comedy"], ["scifi"]];

export function fixtureSeries() {
  const photoIdx = new Map();
  const person = (name) => {
    if (!photoIdx.has(name)) photoIdx.set(name, photoIdx.size + 1);
    return { name, photo: `https://image.tmdb.org/t/p/w185/a${photoIdx.get(name)}.jpg` };
  };
  const out = [];
  for (let id = 1; id <= 60; id++) {
    const g = Math.ceil(id / 5);
    const slot = (id - 1) % 5;
    const names = [`Hub${g} Actor`];
    for (let j = 1; j <= GROUPS; j++) {
      if (j === g || j % 5 !== slot) continue;
      const [a, b] = g < j ? [g, j] : [j, g];
      names.push(`Link${a}x${b} Actor`);
    }
    for (let k = 1; names.length < 6; k++) names.push(`Filler${id}x${k} Actor`);
    const cast = names.map(person);
    out.push({
      tmdbId: id,
      name: `Series ${id}`,
      year: 2000 + (id % 12),
      genres: GENRES[id % 4],
      lang: id % 10 === 0 ? "ko" : "en",
      seasons: 1 + (id % 4),
      creators: [`Creator ${g}`],
      cast,
      overviewHe: `סדרה על ${names[0].split(" ")[0]} ועוד`,
      poster: `/poster${id}.jpg`,
      tmdbVotes: 10000 - 100 * id,
    });
  }
  return out;
}
