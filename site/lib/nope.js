export const NOPE_KEY = "bingology:nope";

function storedIds(storage) {
  try {
    const raw = storage.getItem(NOPE_KEY);
    const ids = raw ? JSON.parse(raw).nope : null;
    return Array.isArray(ids) ? ids : [];
  } catch (e) { return []; }
}

/** "Not for me" marks as a Set of indices into S. Never throws. */
export function loadNope(storage, S) {
  try {
    const byId = new Map(S.map((s, i) => [s.tmdbId, i]));
    return new Set(storedIds(storage).map(id => byId.get(id)).filter(i => i !== undefined));
  } catch (e) {}
  return new Set();
}

/** Save marks as TMDB ids, keeping ids of series that are not in today's data. */
export function saveNope(storage, nope, S) {
  try {
    const present = new Set(S.map(s => s.tmdbId));
    const kept = storedIds(storage).filter(id => !present.has(id));
    storage.setItem(NOPE_KEY, JSON.stringify({ nope: kept.concat([...nope].map(i => S[i].tmdbId)) }));
  } catch (e) {}
}
