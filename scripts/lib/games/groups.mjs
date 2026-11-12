import { card, langName, leadNames } from "./pool.mjs";
import { shuffle, sample } from "./rng.mjs";

const TRIES = 200;
const SIZE = 4;
// An actor group only gathers series where the actor is billed in the first LEAD names.
export const LEAD = 5;

export const decadeOf = (year) => (Number.isInteger(year) ? Math.floor(year / 10) * 10 : null);

const castNames = (s) => [...new Set((s.cast ?? []).map((c) => (typeof c === "string" ? c : c.name)))];

export function fits(kind, key, s) {
  if (kind === "actor") return castNames(s).includes(key);
  if (kind === "creator") return (s.creators ?? []).includes(key);
  if (kind === "decade") return s.year != null && decadeOf(s.year) === key;
  if (kind === "lang") return s.lang === key;
  return false;
}

function label(kind, key) {
  if (kind === "actor") return `שחקן/ית משותף/ת: ${key}`;
  if (kind === "creator") return `יוצר/ת: ${key}`;
  if (kind === "decade") return `שנות ה-${key}`;
  return `בשפה: ${langName(key)}`;
}

export const groupKey = (kind, key) => `${kind}:${key}`;

function candidates(known) {
  const buckets = new Map();
  const add = (kind, key, s) => {
    if (key == null || key === "") return;
    const k = `${kind}\u0000${key}`;
    if (!buckets.has(k)) buckets.set(k, { kind, key, ids: new Set() });
    buckets.get(k).ids.add(s.tmdbId);
  };
  for (const s of known) {
    for (const n of leadNames(s, LEAD)) add("actor", n, s);
    for (const c of new Set(s.creators ?? [])) add("creator", c, s);
    add("decade", decadeOf(s.year), s);
    if (s.lang && s.lang !== "en" && langName(s.lang)) add("lang", s.lang, s);
  }
  return [...buckets.values()].filter((c) => c.ids.size >= SIZE);
}

export function make(pool, rng, recent) {
  const cands = candidates(pool.wide).filter((c) => !recent.groups.has(groupKey(c.kind, c.key)));
  if (cands.length < SIZE) return null;
  for (let t = 0; t < TRIES; t++) {
    const picked = sample(rng, cands, SIZE);
    if (new Set(picked.map((c) => c.kind)).size < 3) continue;
    const groups = [];
    for (const c of picked) {
      const others = picked.filter((o) => o !== c);
      const eligible = pool.wide.filter(
        (s) => c.ids.has(s.tmdbId) && !others.some((o) => fits(o.kind, o.key, s)),
      );
      if (eligible.length < SIZE) break;
      groups.push({ c, series: sample(rng, eligible, SIZE) });
    }
    if (groups.length < SIZE) continue;
    const mean = (g) => g.series.reduce((a, s) => a + (s.tmdbVotes ?? 0), 0) / SIZE;
    const ranked = [...groups].sort((a, b) => mean(b) - mean(a));
    const out = groups.map((g) => ({
      kind: g.c.kind,
      key: g.c.key,
      label: label(g.c.kind, g.c.key),
      level: ranked.indexOf(g) + 1,
      ids: g.series.map((s) => s.tmdbId),
    }));
    const items = shuffle(rng, groups.flatMap((g) => g.series)).map(card);
    return { puzzle: { items, groups: out }, used: { groups: out.map((g) => groupKey(g.kind, g.key)) } };
  }
  return null;
}
