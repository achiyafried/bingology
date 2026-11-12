import { pick } from "./rng.mjs";
import { safeImg } from "../../../site/lib/esc.js";

const hasActor = (s, name) => (s.cast ?? []).some((c) => c.name === name);

export function make(pool, rng, recent) {
  try {
    const cands = [];
    for (const [name, ids] of pool.actorsKnown) {
      if (new Set(ids).size < 2 || recent.actors.has(name)) continue;
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
