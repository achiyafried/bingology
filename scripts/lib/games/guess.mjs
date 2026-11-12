import { GENRES } from "../../../site/lib/score.js";
import { card, langName } from "./pool.mjs";
import { shuffle } from "./rng.mjs";

const MASK = "███";
const MAX = 220;

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function maskOverview(s) {
  let t = s.overviewHe;
  const names = [s.name, ...(s.cast ?? []).map((c) => c.name), ...(s.creators ?? [])]
    .filter((n) => typeof n === "string" && n.trim())
    .sort((a, b) => b.length - a.length);
  for (const n of names) t = t.replace(new RegExp(escRe(n), "gi"), MASK);
  t = t.trim();
  if (t.length <= MAX) return t;
  const cut = t.slice(0, MAX + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut.slice(0, MAX)).trimEnd() + "…";
}

export function cluesFor(s) {
  const clues = [];
  const genres = (s.genres ?? []).map((g) => GENRES[g]).filter(Boolean);
  if (genres.length && s.year) clues.push({ kind: "genreYear", text: `${genres.join(", ")} · ${s.year}` });
  const lang = s.lang && langName(s.lang);
  if (lang && s.seasons > 0) clues.push({ kind: "langSeasons", text: `${lang} · ${s.seasons === 1 ? "עונה אחת" : `${s.seasons} עונות`}` });
  if (s.creators?.length) clues.push({ kind: "creators", text: "יוצרים: " + s.creators.join(", ") });
  if (s.cast?.[0]?.name) clues.push({ kind: "actor", text: "בכיכוב " + s.cast[0].name });
  if (s.overviewHe) clues.push({ kind: "overview", text: maskOverview(s) });
  if (s.poster) clues.push({ kind: "poster", text: "", img: s.poster });
  return clues;
}

export function make(pool, rng, recent) {
  const candidates = shuffle(rng, pool.known.filter((s) => !recent.series.has(s.tmdbId)));
  for (const s of candidates) {
    const clues = cluesFor(s);
    if (clues.length >= 5) return { puzzle: { answer: card(s), clues }, used: { series: [s.tmdbId] } };
  }
  return null;
}
