// The kids section: kids.json (hand-written) → site/kids-data.json (nightly, with TMDB details).
import { minAgeOf } from "./tmdb.mjs";
import { providersOf } from "./providers.mjs";

export const AGES = ["small", "mid", "big"];
/** The oldest TMDB minimum age each group may show. */
export const AGE_CAP = { small: 7, mid: 10, big: 13 };

const IMG = "https://image.tmdb.org/t/p/w342";
const text = v => typeof v === "string" && v.trim() !== "";

/** Problems in kids.json, one per problem naming the row; [] when it is good. */
export function validateKids(list) {
  if (!Array.isArray(list)) return ["kids.json must be an array"];
  const errs = [], seen = new Set();
  list.forEach((r, i) => {
    const e = m => errs.push(`row ${i}: ${m}`);
    if (!r || typeof r !== "object") return e("must be an object");
    if (!Number.isInteger(r.tmdb) || r.tmdb <= 0) e("tmdb must be a TMDB id");
    else if (seen.has(r.tmdb)) e(`duplicate tmdb ${r.tmdb}`);
    else seen.add(r.tmdb);
    if (!AGES.includes(r.age)) e(`age must be one of ${AGES.join(", ")}`);
    if ("he" in r && !text(r.he)) e("he (Hebrew name) must be non-empty text");
  });
  return errs;
}

const heText = (he, en) => { const t = he?.trim(); return t && t !== en ? t : null; };

/** /tv/{id} (en-US, with watch/providers and content_ratings) + its he-IL response → the series' live fields. */
export function kidsLive(tv, he, map) {
  const year = parseInt(tv.first_air_date, 10);
  return {
    name: tv.name, nameHe: heText(he?.name, tv.name),
    poster: tv.poster_path ? IMG + tv.poster_path : null,
    overview: he?.overview?.trim() || null, overviewEn: tv.overview?.trim() || null,
    year: Number.isFinite(year) ? year : null, seasons: tv.number_of_seasons ?? null,
    vote: tv.vote_count > 0 ? Math.round(tv.vote_average * 10) / 10 : null,
    minAge: minAgeOf(tv),
    ...providersOf(tv["watch/providers"], map),
  };
}

/** True when TMDB rates the series older than its group allows. */
export const overCap = row => row.minAge != null && row.minAge > AGE_CAP[row.age];
