const IMG = "https://image.tmdb.org/t/p/";
const CAST_MAX = 10;

/** Typical episode length in minutes: median of episode_run_time, else null (the last episode is often a long finale). */
export function medianRuntime(tv) {
  const v = (tv.episode_run_time || []).filter(n => n > 0).sort((a, b) => a - b);
  if (v.length) {
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  }
  return null;
}

/** TMDB status → "airing" | "ended" | "canceled" (falls back to in_production). */
export function statusOf(tv) {
  if (tv.status === "Ended") return "ended";
  if (tv.status === "Canceled") return "canceled";
  if (tv.status) return "airing"; // Returning Series, In Production, Planned, Pilot
  return tv.in_production ? "airing" : "ended";
}

const US_DISNEY = ["Disney Plus", "Hulu"];
const US_AGE = { "TV-Y": 0, "TV-Y7": 7, "TV-G": 0, "TV-PG": 10, "TV-14": 14, "TV-MA": 17 };

/** Minimum viewer age from TMDB content ratings: the US TV rating, else the first numeric rating anywhere. */
export function minAgeOf(tv) {
  const list = tv.content_ratings?.results ?? [];
  const us = list.find(r => r.iso_3166_1 === "US" && r.rating in US_AGE);
  if (us) return US_AGE[us.rating];
  for (const r of list) { const n = parseInt(r.rating, 10); if (Number.isFinite(n)) return n; }
  return null;
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

/** Episodes per regular season, in order (specials excluded, empty seasons dropped). */
function seasonEpsOf(tv) {
  if (!Array.isArray(tv.seasons)) return null;
  const eps = tv.seasons.filter(s => s.season_number > 0 && s.episode_count > 0).map(s => s.episode_count);
  return eps.length ? eps : null;
}

/** TMDB /tv/{id} (en-US, with credits/providers/external_ids appended) + the he-IL response → live fields. */
export function transformTv(tv, { map, he } = {}) {
  const warnings = [];
  const flatrate = tv["watch/providers"]?.results?.IL?.flatrate ?? [];
  const { cats: ilCats, unknown } = mapProviders(flatrate, map);
  // TMDB/JustWatch has no Disney+ data for Israel. Disney+ here also carries Hulu/FX content, so a US
  // Disney Plus or Hulu listing is a reasonable guess — kept separately so the site can say "probably".
  const us = (tv["watch/providers"]?.results?.US?.flatrate ?? []).map(p => p.provider_name);
  const guess = !ilCats.includes("disney") && us.some(n => US_DISNEY.includes(n)) ? ["disney"] : [];
  const keys = Object.keys(map), all = new Set([...ilCats, ...guess]);
  const cats = keys.filter(k => all.has(k)).concat(all.has("other") ? ["other"] : []);
  for (const u of unknown) warnings.push(`unknown IL provider "${u}"`);
  const cast = [...(tv.aggregate_credits?.cast ?? [])]
    .sort((a, b) => (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0) || a.order - b.order)
    .slice(0, CAST_MAX)
    .map(c => ({ name: c.name, photo: c.profile_path ? `${IMG}w185${c.profile_path}` : null }));
  const live = {
    year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
    seasons: tv.number_of_seasons || null,
    seasonEps: seasonEpsOf(tv),
    episodes: tv.number_of_episodes || null,
    runtime: medianRuntime(tv),
    runtimeLast: tv.last_episode_to_air?.runtime || null,
    status: statusOf(tv),
    lang: tv.original_language || null,
    poster: tv.poster_path ? `${IMG}w342${tv.poster_path}` : null,
    creators: (tv.created_by ?? []).map(c => c.name),
    cast,
    providers: cats,
    providersGuess: guess,
    providersOther: [...new Set(unknown)], // the real names behind "other", shown on cards
    next: tv.next_episode_to_air?.air_date
      ? { season: tv.next_episode_to_air.season_number, episode: tv.next_episode_to_air.episode_number, date: tv.next_episode_to_air.air_date }
      : null,
    streams: {
      IL: flatrate.map(p => p.provider_name), US: us,
      UK: (tv["watch/providers"]?.results?.GB?.flatrate ?? []).map(p => p.provider_name),
    },
    // Only the Hebrew response counts: English text is not a Hebrew description.
    overviewHe: he?.overview?.trim() || null,
    overviewEn: tv.overview?.trim() || null, // shown only when there is no Hebrew text
    imdbId: tv.external_ids?.imdb_id || null,
    minAge: minAgeOf(tv),
    tmdbVote: tv.vote_count > 0 ? Math.round(tv.vote_average * 10) / 10 : null,
    tmdbVotes: tv.vote_count > 0 ? tv.vote_count : null,
  };
  return { live, warnings };
}
