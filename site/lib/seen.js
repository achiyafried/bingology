const V1 = "tvpick:v1"; // artifact era: positions 0..127
const V2 = "tvpick:v2"; // TMDB ids

function storedIds(storage) {
  try { const v2 = storage.getItem(V2); return v2 ? JSON.parse(v2).seen || [] : null; } catch (e) { return null; }
}

/** "Already watched" marks as a Set of indices into S. Never throws. */
export function loadSeen(storage, S) {
  try {
    const ids = storedIds(storage);
    if (ids) {
      const byId = new Map(S.map((s, i) => [s.tmdbId, i]));
      return new Set(ids.map(id => byId.get(id)).filter(i => i !== undefined));
    }
    const v1 = storage.getItem(V1);
    if (v1) return new Set((JSON.parse(v1).seen || []).filter(n => Number.isInteger(n) && n >= 0 && n < S.length));
  } catch (e) {}
  return new Set();
}

/** Save marks as TMDB ids, keeping ids of series that are not in today's data (e.g. rotated out of the pool). */
export function saveSeen(storage, seen, S) {
  try {
    const present = new Set(S.map(s => s.tmdbId));
    const kept = (storedIds(storage) || []).filter(id => !present.has(id));
    storage.setItem(V2, JSON.stringify({ seen: kept.concat([...seen].map(i => S[i].tmdbId)) }));
  } catch (e) {}
}
