// The wide pool: TMDB's best-rated series beyond the curated lists, with tags guessed from genres.
export const POOL_SIZE = 500;
export const EXCLUDED_GENRES = [16, 10762, 10763, 10764, 10767]; // animation, kids, news, reality, talk
const PRIOR_VOTES = 1000;

export const discoverParams = page => ({
  language: "en-US", sort_by: "vote_count.desc", "vote_average.gte": 7.5, "vote_count.gte": 500,
  without_genres: EXCLUDED_GENRES.join("|"), page,
});

/** Best `n` ids by vote-weighted rating, skipping duplicates, curated ids and excluded genres. */
export function rankPool(results, curatedIds, n) {
  const seen = new Set(), list = [];
  for (const r of results) {
    if (seen.has(r.id) || curatedIds.has(r.id) || (r.genre_ids || []).some(g => EXCLUDED_GENRES.includes(g))) continue;
    seen.add(r.id); list.push(r);
  }
  const mean = list.reduce((a, r) => a + r.vote_average, 0) / (list.length || 1);
  const score = r => (r.vote_average * r.vote_count + mean * PRIOR_VOTES) / (r.vote_count + PRIOR_VOTES);
  return list.sort((a, b) => score(b) - score(a)).slice(0, n).map(r => r.id);
}

const GENRE_MAP = { 10759: ["thriller"], 35: ["comedy"], 80: ["crime"], 99: ["doc"], 18: ["drama"], 9648: ["mystery"], 10765: ["scifi", "fantasy"], 10768: ["history"], 37: ["history"], 10766: ["drama"] };
const MOOD_MAP = { comedy: ["laugh"], drama: ["feel"], crime: ["tense"], thriller: ["tense"], mystery: ["tense", "think"], scifi: ["think", "escape"], fantasy: ["escape"], history: ["think"], doc: ["think"] };
const uniq = a => [...new Set(a)];

/** Guess genres, moods and weight for a series from its TMDB details and minimum age. */
export function autoTags(tv, minAge) {
  let genres = uniq((tv.genres || []).flatMap(g => GENRE_MAP[g.id] || []));
  if (!genres.length) genres = ["drama"];
  const moods = uniq(genres.flatMap(g => MOOD_MAP[g] || []));
  if ((tv.origin_country || []).includes("IL")) genres.push("israeli");
  const weight = genres.includes("comedy") && minAge != null && minAge <= 14 ? 1
    : (genres.includes("drama") || genres.includes("crime")) && minAge >= 17 ? 3 : 2;
  return { genres, moods: moods.length ? moods : ["feel"], weight };
}

/** A pool series in the same shape as a curated series.json entry. */
export function poolEntry(tv, minAge) {
  return { tmdbId: tv.id, name: tv.name, lists: ["pool"], ...autoTags(tv, minAge), solo: false, blurb: "", rt: null, fallback: {} };
}
