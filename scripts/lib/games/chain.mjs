import { card } from "./pool.mjs";
import { shuffle } from "./rng.mjs";

const EXTRA = 2;

const castNames = (s) => [...new Set((s.cast ?? []).map((c) => (typeof c === "string" ? c : c.name)))];

// BFS over series, each hop through a shared actor counts 1.
function distances(neighbors, from, max = Infinity) {
  const dist = new Map([[from, 0]]);
  let frontier = [from];
  for (let d = 1; frontier.length && d <= max; d++) {
    const next = [];
    for (const id of frontier) {
      for (const n of neighbors(id)) {
        if (!dist.has(n)) {
          dist.set(n, d);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

export function shortestActors(seriesMap, from, to) {
  const byActor = new Map();
  for (const [id, s] of Object.entries(seriesMap)) {
    for (const a of s.cast) {
      if (!byActor.has(a)) byActor.set(a, []);
      byActor.get(a).push(String(id));
    }
  }
  const neighbors = (id) => (seriesMap[id]?.cast ?? []).flatMap((a) => byActor.get(a) ?? []);
  const d = distances(neighbors, String(from)).get(String(to));
  return d ?? Infinity;
}

const pairKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export function make(pool, rng, recent) {
  const cast = new Map(pool.known.map((s) => [s.tmdbId, castNames(s)]));
  const byActor = new Map();
  for (const [id, names] of cast) {
    for (const a of names) {
      if (!byActor.has(a)) byActor.set(a, []);
      byActor.get(a).push(id);
    }
  }
  const neighbors = (id) => cast.get(id).flatMap((a) => byActor.get(a));

  for (const from of shuffle(rng, pool.known.map((s) => s.tmdbId))) {
    const dist = distances(neighbors, from, 3);
    const ok = (d) =>
      [...dist].filter(([id, x]) => x === d && !recent.pairs.has(pairKey(from, id))).map(([id]) => id);
    const threes = ok(3);
    const twos = ok(2);
    const shortest = threes.length ? 3 : twos.length ? 2 : 0;
    if (!shortest) continue;
    const cands = shortest === 3 ? threes : twos;
    const to = cands[Math.floor(rng() * cands.length)];
    const limit = shortest + EXTRA;
    const reach = distances(neighbors, from, limit);
    const series = {};
    for (const id of reach.keys()) {
      const s = pool.byId.get(id);
      series[id] = { name: s.name, poster: card(s).poster, cast: cast.get(id) };
    }
    return { puzzle: { from, to, shortest, limit, series }, used: { pairs: [pairKey(from, to)] } };
  }
  return null;
}
