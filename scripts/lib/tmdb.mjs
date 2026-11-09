const IMG = "https://image.tmdb.org/t/p/";
const CAST_MAX = 10;

/** Typical episode length in minutes: median of episode_run_time, else the last aired episode, else null. */
export function medianRuntime(tv) {
  const v = (tv.episode_run_time || []).filter(n => n > 0).sort((a, b) => a - b);
  if (v.length) {
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  }
  return tv.last_episode_to_air?.runtime || null;
}

/** TMDB status → "airing" | "ended" | "canceled" (falls back to in_production). */
export function statusOf(tv) {
  if (tv.status === "Ended") return "ended";
  if (tv.status === "Canceled") return "canceled";
  if (tv.status) return "airing"; // Returning Series, In Production, Planned, Pilot
  return tv.in_production ? "airing" : "ended";
}

/** IL flatrate providers → our categories, in providers.json order, "other" last. */
export function mapProviders(flatrate, map) {
  const byName = new Map();
  for (const [cat, names] of Object.entries(map)) for (const n of names) byName.set(n.toLowerCase(), cat);
  const found = new Set(), unknown = [];
  for (const p of flatrate || []) {
    const cat = byName.get(p.provider_name.toLowerCase());
    if (cat) found.add(cat);
    else { found.add("other"); unknown.push(p.provider_name); }
  }
  const cats = Object.keys(map).filter(c => found.has(c));
  if (found.has("other")) cats.push("other");
  return { cats, unknown };
}

/** TMDB /tv/{id} (he-IL, with credits/providers/external_ids appended) → live fields. */
export function transformTv(tv, { map } = {}) {
  const warnings = [];
  const flatrate = tv["watch/providers"]?.results?.IL?.flatrate ?? [];
  const { cats, unknown } = mapProviders(flatrate, map);
  for (const u of unknown) warnings.push(`unknown IL provider "${u}"`);
  const cast = [...(tv.aggregate_credits?.cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .slice(0, CAST_MAX)
    .map(c => ({ name: c.name, photo: c.profile_path ? `${IMG}w185${c.profile_path}` : null }));
  const live = {
    year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
    seasons: tv.number_of_seasons || null,
    episodes: tv.number_of_episodes || null,
    runtime: medianRuntime(tv),
    status: statusOf(tv),
    lang: tv.original_language || null,
    poster: tv.poster_path ? `${IMG}w342${tv.poster_path}` : null,
    creators: (tv.created_by ?? []).map(c => c.name),
    cast,
    providers: cats,
    // English text is not Hebrew: only a Hebrew overview counts.
    overviewHe: tv.overview?.trim() || null,
    imdbId: tv.external_ids?.imdb_id || null,
  };
  return { live, warnings };
}
