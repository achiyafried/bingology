import { card } from "./pool.mjs";
import { shuffle } from "./rng.mjs";

const ROUNDS = 3;
const YEAR_GAP = 5;
const MIN_SERIES = 3;
const MIN_KNOWN = 2;

// actor name -> distinct series ids across the whole pool, most-voted first (cached per pool).
const byActor = new WeakMap();
function actorSeries(pool) {
  if (byActor.has(pool)) return byActor.get(pool);
  const m = new Map();
  for (const s of pool.all) {
    for (const c of new Set((s.cast ?? []).map((x) => x.name))) {
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(s);
    }
  }
  for (const [name, list] of m) {
    if (list.length < MIN_SERIES || list.filter((s) => pool.knownIds.has(s.tmdbId)).length < MIN_KNOWN) m.delete(name);
    else list.sort((x, y) => (y.tmdbVotes ?? 0) - (x.tmdbVotes ?? 0) || x.tmdbId - y.tmdbId);
  }
  byActor.set(pool, m);
  return m;
}

function impostorsFor(pool, actor, three) {
  const ids = new Set(three.map((s) => s.tmdbId));
  const genres = new Set(three.flatMap((s) => s.genres ?? []));
  return pool.known.filter((s) => {
    if (ids.has(s.tmdbId)) return false;
    if ((s.cast ?? []).some((c) => c.name === actor)) return false;
    if (!(s.genres ?? []).some((g) => genres.has(g))) return false;
    return s.year != null && three.some((t) => t.year != null && Math.abs(t.year - s.year) <= YEAR_GAP);
  });
}

function makeRound(pool, rng, actor, list) {
  const three = list.slice(0, 3);
  const imps = impostorsFor(pool, actor, three);
  if (!imps.length) return null;
  const impostor = imps[Math.floor(rng() * imps.length)];
  const four = shuffle(rng, [...three, impostor]);
  return {
    actor: { name: actor, photo: pool.photo.get(actor) ?? null },
    series: four.map(card),
    odd: four.indexOf(impostor),
  };
}

export function make(pool, rng, recent) {
  const eligible = actorSeries(pool);
  const names = shuffle(rng, [...eligible.keys()].filter((n) => !recent.oddActors.has(n)));
  const rounds = [];
  for (const n of names) {
    const r = makeRound(pool, rng, n, eligible.get(n));
    if (r) rounds.push(r);
    if (rounds.length === ROUNDS) {
      return { puzzle: { rounds }, used: { oddActors: rounds.map((x) => x.actor.name) } };
    }
  }
  return null;
}
