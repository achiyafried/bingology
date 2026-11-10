const V1 = "tvpick:v1"; // artifact era: positions 0..127
const V2 = "tvpick:v2"; // TMDB ids

/** "Already watched" marks as a Set of indices into S. Never throws. */
export function loadSeen(storage, S) {
  try {
    const v2 = storage.getItem(V2);
    if (v2) {
      const byId = new Map(S.map((s, i) => [s.tmdbId, i]));
      return new Set((JSON.parse(v2).seen || []).map(id => byId.get(id)).filter(i => i !== undefined));
    }
    const v1 = storage.getItem(V1);
    if (v1) return new Set((JSON.parse(v1).seen || []).filter(n => Number.isInteger(n) && n >= 0 && n < S.length));
  } catch (e) {}
  return new Set();
}

export function saveSeen(storage, seen, S) {
  try { storage.setItem(V2, JSON.stringify({ seen: [...seen].map(i => S[i].tmdbId) })); } catch (e) {}
}
