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

/**
 * Local marks (indexes into S) the account overrides: a row exists for the series with a status other than 'nope'.
 * The account wins, so these marks are dropped. No row (not migrated yet) or a nope row keeps the mark.
 */
export function staleNope(S, nope, entries) {
  if (!entries) return [];
  return [...nope].filter(i => { const e = S[i] && entries.get(S[i].tmdbId); return !!e && e.status !== "nope"; });
}

/** Whether a write moved my row off 'nope' (to another status, or deleted it): the local mark should go too. */
export const nopeCleared = (prev, row) => !!prev && prev.status === "nope" && (!row || row.status !== "nope");

/** Save marks as TMDB ids, keeping ids of series that are not in today's data. */
export function saveNope(storage, nope, S) {
  try {
    const present = new Set(S.map(s => s.tmdbId));
    const kept = storedIds(storage).filter(id => !present.has(id));
    storage.setItem(NOPE_KEY, JSON.stringify({ nope: kept.concat([...nope].map(i => S[i].tmdbId)) }));
  } catch (e) {}
}
