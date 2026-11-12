export const KNOWN = 300;
// groups needs a wider pool: top-300 has no actor in 4 series that fits a puzzle.
export const GROUPS_KNOWN = 600;

// Billing = index in a series' `cast` (0 = first credited). Names within the first `n` of a series.
export function leadNames(s, n) {
  return new Set((s.cast ?? []).slice(0, n).map((c) => (typeof c === "string" ? c : c.name)));
}

const LANG = new Intl.DisplayNames(["he"], { type: "language", fallback: "none" });

// Hebrew language name, or undefined for codes ICU doesn't know (e.g. "cn", "xx").
export function langName(code) {
  try { return LANG.of(code) ?? undefined; } catch { return undefined; }
}

export function buildPool(series, { known = KNOWN } = {}) {
  const all = series.filter((s) => s && s.tmdbId != null);
  const byVotes = [...all].sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0));
  const knownList = byVotes.slice(0, known);
  const wide = byVotes.slice(0, GROUPS_KNOWN);
  const byId = new Map(all.map((s) => [s.tmdbId, s]));
  const knownIds = new Set(knownList.map((s) => s.tmdbId));
  const actorsKnown = new Map();
  const photo = new Map();
  for (const s of knownList) {
    for (const c of s.cast ?? []) {
      if (!actorsKnown.has(c.name)) actorsKnown.set(c.name, []);
      actorsKnown.get(c.name).push(s.tmdbId);
    }
  }
  for (const s of all) {
    for (const c of s.cast ?? []) if (c.photo && !photo.has(c.name)) photo.set(c.name, c.photo);
  }
  return { all, known: knownList, wide, byId, knownIds, actorsKnown, photo };
}

export function card(s) {
  return { id: s.tmdbId, name: s.name, poster: s.poster ?? null };
}

export function emptyRecent() {
  return { series: new Set(), actors: new Set(), pairs: new Set(), oddActors: new Set(), groups: new Set() };
}
