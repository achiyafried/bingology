import { card } from "./pool.mjs";
import { shuffle } from "./rng.mjs";

// The goal is always exactly SHORTEST actors away; the player may use EXTRA more.
export const SHORTEST = 2;
const EXTRA = 2;
// Fewer series than this makes a near-forced path; skip that start.
export const MIN_SERIES = 8;

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
    for (const a of s.cast ?? []) {
      if (!byActor.has(a)) byActor.set(a, []);
      byActor.get(a).push(String(id));
    }
  }
  const neighbors = (id) => (seriesMap[id]?.cast ?? []).flatMap((a) => byActor.get(a) ?? []);
  const d = distances(neighbors, String(from)).get(String(to));
  return d ?? Infinity;
}

const pairKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export function make(pool, rng, recent, { minSeries = MIN_SERIES } = {}) {
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
    const dist = distances(neighbors, from, SHORTEST);
    const cands = [...dist]
      .filter(([id, d]) => d === SHORTEST && !recent.pairs.has(pairKey(from, id)))
      .map(([id]) => id);
    if (!cands.length) continue;
    const to = cands[Math.floor(rng() * cands.length)];
    const shortest = SHORTEST;
    const limit = SHORTEST + EXTRA;
    const reach = distances(neighbors, from, limit);
    if (reach.size < minSeries) continue;
    const series = {};
    for (const id of reach.keys()) {
      const s = pool.byId.get(id);
      series[id] = { name: s.name, poster: card(s).poster, cast: cast.get(id) };
    }
    return { puzzle: { from, to, shortest, limit, series }, used: { pairs: [pairKey(from, to)] } };
  }
  return null;
}
