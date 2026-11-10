// Adding a series from the GitHub issue form. The issue body is untrusted text: it is only parsed here,
// never executed or passed to a shell.
import { autoTags } from "./discover.mjs";
import { medianRuntime } from "./tmdb.mjs";

const MOOD_KEYS = ["laugh", "feel", "tense", "think", "escape"];
const empty = v => (v == null || v === "" || v === "_No response_" ? null : v);

/** Issue-form markdown ("### Heading\n\nvalue") → the fields we use. */
export function parseIssueForm(body) {
  const sections = {};
  for (const part of String(body || "").split(/^### /m).slice(1)) {
    const nl = part.indexOf("\n");
    const head = (nl < 0 ? part : part.slice(0, nl)).trim();
    sections[head] = (nl < 0 ? "" : part.slice(nl + 1)).trim();
  }
  const find = prefix => Object.entries(sections).find(([h]) => h.startsWith(prefix))?.[1] ?? null;
  const checked = text => (text || "").split("\n").filter(l => /^- \[[xX]\]/.test(l.trim()));
  const moods = checked(find("מצבי רוח")).map(l => (/\((\w+)\)\s*$/.exec(l) || [])[1]).filter(k => MOOD_KEYS.includes(k));
  const w = /\(([123])\)/.exec(find("כמה כבדה") || "");
  return {
    name: empty(find("שם הסדרה")),
    tmdb: empty(find("קישור ל-TMDB")),
    moods,
    weight: w ? Number(w[1]) : null,
    solo: checked(find("עדיף לראות לבד")).length > 0,
    blurb: empty(find("תיאור")),
    extra: [...new Set(checked(find("זמין גם ב")).map(l => (/\((\w+)\)\s*$/.exec(l) || [])[1]).filter(k => ["yes", "hot", "partner", "cellcom", "kan", "disney"].includes(k)))],
  };
}

/** A TMDB TV id from a themoviedb.org/tv/... link or a bare number; anything else → null. */
export function tmdbIdFrom(text) {
  if (!text) return null;
  const t = String(text).trim();
  if (/^\d{1,9}$/.test(t)) return Number(t);
  const m = /themoviedb\.org\/tv\/(\d{1,9})(?:[-/?#]|$)/.exec(t);
  return m ? Number(m[1]) : null;
}

const norm = s => (s || "").trim().toLowerCase();

/** From TMDB search results: one exact-name match, or a clearly dominant result containing the query; else candidates. */
export function chooseMatch(results, query) {
  const q = norm(query);
  const cand = list => ({ candidates: list.slice(0, 5).map(r => ({ id: r.id, name: r.name, year: (r.first_air_date || "").slice(0, 4) || "?" })) });
  if (!results.length) return { candidates: [] };
  const exact = results.filter(r => norm(r.name) === q || norm(r.original_name) === q);
  if (exact.length === 1) return { id: exact[0].id };
  if (exact.length > 1) return cand(exact);
  const [a, b] = results;
  if (norm(a.name).includes(q) && (!b || a.popularity >= 3 * (b.popularity || 0))) return { id: a.id };
  return cand(results);
}

/** A series.json entry: form answers where given, guessed tags otherwise, and a runtime fallback so the nightly run never stalls. */
export function buildEntry(tv, minAge, form) {
  const auto = autoTags(tv, minAge);
  const e = {
    tmdbId: tv.id, name: tv.name, lists: ["mine"],
    genres: auto.genres,
    moods: form.moods && form.moods.length ? form.moods : auto.moods,
    weight: form.weight ?? auto.weight,
    solo: !!form.solo,
    blurb: form.blurb || "",
    rt: null,
    fallback: {
      year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
      seasons: tv.number_of_seasons || null, episodes: tv.number_of_episodes || null,
      runtime: medianRuntime(tv) ?? tv.last_episode_to_air?.runtime ?? 45,
      imdb: null, lang: tv.original_language || null, creators: [], cast: [], providers: [],
    },
  };
  if (form.extra && form.extra.length) e.extraProviders = form.extra;
  return e;
}
