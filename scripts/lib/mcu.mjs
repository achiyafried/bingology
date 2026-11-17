// The MCU timeline: mcu.json (hand-written, story order) → site/mcu-data.json (nightly, with TMDB details).
import { mapProviders, trailerCandidates } from "./tmdb.mjs";

const KINDS = new Set(["movie", "season"]);
const text = v => typeof v === "string" && v.trim() !== "";

/** The id an item must have: movie:<tmdb> or tv:<tmdb>:s<season>. Seen marks are stored by it. */
export const mcuId = r => (r.kind === "season" ? `tv:${r.tmdb}:s${r.season}` : `movie:${r.tmdb}`);

/** Problems in mcu.json, one per problem naming the row; [] when it is good. */
export function validateMcu(list) {
  if (!Array.isArray(list)) return ["mcu.json must be an array"];
  const errs = [], ids = new Set();
  list.forEach((r, i) => {
    const e = m => errs.push(`row ${i}: ${m}`);
    if (!r || typeof r !== "object") return e("not an object");
    if (!KINDS.has(r.kind)) return e(`kind must be movie or season, not ${JSON.stringify(r.kind)}`);
    if (!Number.isInteger(r.tmdb) || r.tmdb <= 0) return e("tmdb must be a TMDB id number");
    if (r.kind === "season" && (!Number.isInteger(r.season) || r.season < 1)) return e("season must be a number from 1");
    if (r.id !== mcuId(r)) e(`id must be ${mcuId(r)}`);
    else if (ids.has(r.id)) e(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (!text(r.era)) e("era is missing");
    if (!text(r.story)) e("story is missing");
    if (!Number.isInteger(r.phase) || r.phase < 1 || r.phase > 6) e("phase must be 1–6");
    if (r.note !== undefined && !text(r.note)) e("note must be text");
  });
  return errs;
}

/** Problems in mcu-characters.json, one per problem naming the row; [] when it is good. mcuIds: the ids in mcu.json. */
export function validateCharacters(list, mcuIds) {
  if (!Array.isArray(list)) return ["mcu-characters.json must be an array"];
  const errs = [], ids = new Set();
  list.forEach((c, i) => {
    const e = m => errs.push(`row ${i}: ${m}`);
    if (!c || typeof c !== "object") return e("not an object");
    if (typeof c.id !== "string" || !/^[a-z0-9-]+$/.test(c.id)) e("id must be lowercase letters, digits and -");
    else if (ids.has(c.id)) e(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!text(c.he)) e("he (Hebrew name) is missing");
    if (!text(c.en)) e("en (English name) is missing");
    if (!Array.isArray(c.people) || !c.people.length || !c.people.every(n => Number.isInteger(n) && n > 0)) e("people must be TMDB person ids");
    try { if (!text(c.match)) throw 0; new RegExp(c.match, "i"); } catch { e("match must be a valid pattern"); }
    if (!mcuIds.has(c.poster)) e(`poster ${JSON.stringify(c.poster)} is not an item in mcu.json`);
  });
  return errs;
}

const IMG = "https://image.tmdb.org/t/p/w342";
const US_DISNEY = ["Disney Plus", "Hulu"];

/** IL providers in providers.json order ("other" last), plus Disney+ guessed from the US listing (TMDB has no IL Disney+ data). */
function providersOf(wp, map) {
  const il = mapProviders(wp?.results?.IL?.flatrate ?? [], map).cats;
  const us = (wp?.results?.US?.flatrate ?? []).map(p => p.provider_name);
  const guess = map.disney && !il.includes("disney") && us.some(n => US_DISNEY.includes(n)) ? ["disney"] : [];
  const all = new Set([...il, ...guess]);
  const providers = Object.keys(map).filter(k => all.has(k)).concat(all.has("other") ? ["other"] : []);
  return { providers, providersGuess: guess };
}

const heText = (he, en) => { const t = he?.trim(); return t && t !== en ? t : null; };
const vote = x => (x.vote_count > 0 ? Math.round(x.vote_average * 10) / 10 : null);

/** /movie/{id} (en-US, with watch/providers and videos) + its he-IL response → the item's live fields and trailer candidates. */
export function movieLive(m, he, map, keep = new Set()) {
  return {
    cast: castOf(m.credits, keep),
    name: m.title, nameHe: heText(he?.title, m.title), date: m.release_date || null,
    runtime: m.runtime || null, episodes: null, poster: m.poster_path ? IMG + m.poster_path : null,
    overview: he?.overview?.trim() || null, overviewEn: m.overview?.trim() || null, vote: vote(m),
    ...providersOf(m["watch/providers"], map),
    cands: trailerCandidates(m),
  };
}

/** /tv/{id} (en-US, with watch/providers and videos) + he-IL + /tv/{id}/season/{n} (with videos) → live fields; the season's trailers come first. */
export function seasonLive(tv, he, s, map, credits = null, keep = new Set()) {
  const eps = s.episodes ?? [];
  const mins = eps.reduce((a, e) => a + (e.runtime || 0), 0);
  return {
    cast: castOf(credits, keep),
    name: tv.name, nameHe: heText(he?.name, tv.name), date: s.air_date || null,
    runtime: mins || null, episodes: eps.length || null,
    poster: s.poster_path ? IMG + s.poster_path : tv.poster_path ? IMG + tv.poster_path : null,
    overview: he?.overview?.trim() || null, overviewEn: s.overview?.trim() || tv.overview?.trim() || null, vote: vote(tv),
    ...providersOf(tv["watch/providers"], map),
    cands: [...new Set([...trailerCandidates(s), ...trailerCandidates(tv)])],
  };
}

/** Cast pairs for the people we follow: movie credits ({character}) or season aggregate_credits ({roles: [{character}]}). */
export function castOf(credits, keep) {
  return (credits?.cast ?? []).filter(c => keep.has(c.id)).map(c => ({
    person: c.id, name: c.name,
    character: c.roles ? c.roles.map(r => r.character).filter(Boolean).join(" / ") : c.character ?? "",
  }));
}

/**
 * Each character's appearances, in story order: a cast pair whose person is one of theirs AND whose character name
 * matches. "(uncredited)" marks a cameo. Characters with none are left out (warning). Most appearances first.
 */
export function appearances(chars, items, warnings) {
  const byId = new Map(items.map(x => [x.id, x]));
  const story = [...items].sort((a, b) => a.story_i - b.story_i);
  const out = [];
  for (const c of chars) {
    const re = new RegExp(c.match, "i"), people = new Set(c.people), apps = [];
    let actor = null;
    for (const x of story) {
      const hit = (x.cast ?? []).find(p => people.has(p.person) && re.test(p.character ?? ""));
      if (!hit) continue;
      apps.push({ id: x.id, as: hit.character.replace(/\s*\(uncredited\)/gi, "").trim(), cameo: /uncredited/i.test(hit.character) });
      actor = hit.name;
    }
    if (!apps.length) { warnings.push(`character ${c.id}: no appearances`); continue; }
    out.push({ id: c.id, he: c.he, en: c.en, poster: byId.get(c.poster)?.poster ?? null, actor, apps });
  }
  return out.sort((a, b) => b.apps.length - a.apps.length || a.he.localeCompare(b.he, "he"));
}
