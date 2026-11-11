const FALLBACK_FIELDS = ["year", "seasons", "episodes", "lang"];
const SCALAR_FIELDS = ["status", "poster", "overviewHe", "tmdbVote", "tmdbVotes", "minAge", "seasonEps"];
// People lists: an empty list from TMDB usually means missing data, so keep looking.
const PEOPLE_FIELDS = ["creators", "cast"];

const pick = (...vals) => vals.find(v => v !== null && v !== undefined) ?? null;

/**
 * One series for data.json. Manual fields come from the entry; each live field falls back
 * to the previous night's value, then to the legacy fallback (including the legacy cast
 * and creators).
 */
export function mergeEntry(entry, live, imdb, prev, now) {
  // A previous entry that never came from a real fetch (offline/dev build) holds nothing live.
  if (prev && !prev.fetchedAt) prev = null;
  const { fallback = {}, ...manual } = entry;
  const s = { ...manual };
  for (const f of FALLBACK_FIELDS) s[f] = pick(live?.[f], prev?.[f], fallback[f]);
  // Runtime: TMDB's typical length, then the curated value, then last night, then the last episode as a last resort.
  s.runtime = pick(live?.runtime, fallback.runtime, prev?.runtime, live?.runtimeLast);
  for (const f of SCALAR_FIELDS) s[f] = pick(live?.[f], prev?.[f]);
  for (const f of PEOPLE_FIELDS) s[f] = [live?.[f], prev?.[f], fallback[f]].find(v => v && v.length) ?? [];
  // Providers: when fetched, live wins even if empty (the series left Israeli streaming).
  // Not fetched: last real fetch if there was one, else the legacy main platform.
  s.providers = live ? live.providers ?? [] : prev ? prev.providers ?? [] : fallback.providers ?? [];
  const extra = manual.extraProviders ?? [];
  s.providers = [...new Set([...s.providers, ...extra])]; // manual "also on" (e.g. yes, HOT) that TMDB does not know
  s.providersGuess = (live ? live.providersGuess ?? [] : prev?.providersGuess ?? []).filter(p => !extra.includes(p));
  // Live-only: a night without a fetch has no news to report, so these never fall back to prev.
  s.next = live ? live.next ?? null : null;
  s.streams = live ? live.streams ?? null : null;
  s.imdb = pick(imdb, prev?.imdb, fallback.imdb);
  s.fetchedAt = live ? now : prev?.fetchedAt ?? null;
  return s;
}

/** Problems that make data.json unsafe to publish; empty array = valid. */
export function validateData(data, expectedCount) {
  const errs = [];
  const list = data?.series ?? [];
  if (list.length !== expectedCount) errs.push(`series count ${list.length} ≠ expected ${expectedCount}`);
  list.forEach((s, i) => {
    const who = `#${i} ${s.name ?? "?"}`;
    if (!Number.isInteger(s.tmdbId)) errs.push(`${who}: tmdbId missing`);
    if (!s.name) errs.push(`${who}: name missing`);
    if (!(s.seasons >= 1)) errs.push(`${who}: seasons ${s.seasons}`);
    if (!(s.episodes >= 1)) errs.push(`${who}: episodes ${s.episodes}`);
    if (!(s.runtime > 0)) errs.push(`${who}: runtime ${s.runtime}`);
    // null = no rating yet (new shows); the site handles it. Anything else must be a real number.
    if (s.imdb !== null && !(typeof s.imdb === "number" && s.imdb >= 0 && s.imdb <= 10)) errs.push(`${who}: imdb ${s.imdb}`);
  });
  return errs;
}

export const shouldAbort = (failed, total) => failed / total > 0.2;

const strip = d => JSON.stringify({ ...d, updatedAt: undefined, series: (d.series ?? []).map(s => ({ ...s, fetchedAt: undefined })) });

/** True when two data.json objects differ only in timestamps. */
export function sameData(a, b) {
  if (!a || !b) return false;
  return strip(a) === strip(b);
}
