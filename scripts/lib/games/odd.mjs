import { card } from "./pool.mjs";
import { shuffle } from "./rng.mjs";

const ROUNDS = 3;
const TRIPLE_TRIES = 3;
const YEAR_GAP = 5;

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

function makeRound(pool, rng, actor) {
  const ids = [...new Set(pool.actorsKnown.get(actor))];
  if (ids.length < 3) return null;
  const mine = ids.map((id) => pool.byId.get(id));
  for (let i = 0; i < TRIPLE_TRIES; i++) {
    const three = shuffle(rng, mine).slice(0, 3);
    const imps = impostorsFor(pool, actor, three);
    if (!imps.length) continue;
    const impostor = imps[Math.floor(rng() * imps.length)];
    const four = shuffle(rng, [...three, impostor]);
    return {
      actor: { name: actor, photo: pool.photo.get(actor) ?? null },
      series: four.map(card),
      odd: four.indexOf(impostor),
    };
  }
  return null;
}

export function make(pool, rng, recent) {
  const names = shuffle(rng, [...pool.actorsKnown.keys()].filter(
    (n) => !recent.actors.has(n) && new Set(pool.actorsKnown.get(n)).size >= 3,
  ));
  const rounds = [];
  for (const n of names) {
    const r = makeRound(pool, rng, n);
    if (r) rounds.push(r);
    if (rounds.length === ROUNDS) {
      return { puzzle: { rounds }, used: { actors: rounds.map((x) => x.actor.name) } };
    }
  }
  return null;
}
