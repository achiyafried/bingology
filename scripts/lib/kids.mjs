// The kids section: kids.json (hand-written) → site/kids-data.json (nightly, with TMDB details).
import { minAgeOf } from "./tmdb.mjs";
import { providersOf } from "./providers.mjs";

export const AGES = ["small", "mid", "big"];
/** The oldest TMDB minimum age each group may show. */
export const AGE_CAP = { small: 7, mid: 10, big: 13 };

const IMG = "https://image.tmdb.org/t/p/w342";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const ART_IMG = /^\/[\w.-]+\.(jpg|png)$/;
const CHANNEL = /^UC[\w-]{22}$/;
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
    if ("art" in r) {
      const a = r.art;
      if (!a || typeof a !== "object" || Array.isArray(a)) e("art must be an object");
      else {
        if ("img" in a && !(typeof a.img === "string" && ART_IMG.test(a.img))) e("art.img must be a TMDB path like /abc.jpg");
        for (const k of ["x", "y", "r"])
          if (k in a && !(typeof a[k] === "number" && a[k] >= (k === "r" ? Number.MIN_VALUE : 0) && a[k] <= 1)) e(k === "r" ? "art.r must be a number above 0 and up to 1" : `art.${k} must be a number from 0 to 1`);
      }
    }
    if ("yt" in r) {
      const y = r.yt;
      if (!Array.isArray(y) || y.length < 1 || y.length > 3) e("yt must be an array of 1-3 channels");
      else {
        const ids = new Set();
        y.forEach(c => {
          if (!c || typeof c !== "object") return e("yt entries must be objects");
          if (typeof c.channel !== "string" || !CHANNEL.test(c.channel)) e("yt.channel must be a YouTube channel id (UC + 22 chars)");
          else if (ids.has(c.channel)) e(`yt has channel ${c.channel} twice`);
          else ids.add(c.channel);
          if ("match" in c && !text(c.match)) e("yt.match must be non-empty text");
        });
      }
    }
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

/** TMDB images object + the row's art → the game backdrop (hand-picked, else first textless) and sticker spot. */
export function kidsArt(images, art) {
  const path = art?.img ?? images?.backdrops?.find(b => b.iso_639_1 == null)?.file_path ?? null;
  return {
    backdrop: path ? BACKDROP + path : null,
    sticker: { x: art?.x ?? 0.5, y: art?.y ?? 0.5, r: art?.r ?? 0.3 },
  };
}
