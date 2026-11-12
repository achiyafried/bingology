import { pick } from "./rng.mjs";
import { leadNames } from "./pool.mjs";
import { safeImg } from "../../../site/lib/esc.js";

// Only lead roles count: billing (index in `cast`) below this, in MIN_SERIES series of the wide (top-600) pool.
// Top-300 has only ~53 such actors, fewer than the 60-day no-repeat window needs.
export const LEAD = 3;
const MIN_SERIES = 2;

const hasActor = (s, name) => (s.cast ?? []).some((c) => c.name === name);

export function make(pool, rng, recent) {
  try {
    const leads = new Map();
    for (const s of pool.wide) for (const n of leadNames(s, LEAD)) leads.set(n, (leads.get(n) ?? 0) + 1);
    const cands = [];
    for (const [name, n] of leads) {
      if (n < MIN_SERIES || recent.actors.has(name)) continue;
      const photo = safeImg((pool.photo.get(name) ?? "").replace("/w185/", "/w342/"));
      if (photo) cands.push({ name, photo });
    }
    const a = pick(rng, cands);
    if (!a) return null;
    const series = pool.all
      .filter((s) => hasActor(s, a.name))
      .sort((x, y) => (x.tmdbVotes ?? 0) - (y.tmdbVotes ?? 0));
    const names = [...new Map(series.map((s) => [s.tmdbId, s.name])).values()];
    return {
      puzzle: { actor: { name: a.name, photo: a.photo }, count: names.length, series: names },
      used: { actors: [a.name] },
    };
  } catch {
    return null;
  }
}
