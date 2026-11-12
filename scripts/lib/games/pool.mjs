export const KNOWN = 300;

export function buildPool(series, { known = KNOWN } = {}) {
  const all = series.filter((s) => s && s.tmdbId != null);
  const knownList = [...all].sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0)).slice(0, known);
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
  return { all, known: knownList, byId, knownIds, actorsKnown, photo };
}

export function card(s) {
  return { id: s.tmdbId, name: s.name, poster: s.poster ?? null };
}

export function emptyRecent() {
  return { series: new Set(), actors: new Set(), pairs: new Set() };
}
