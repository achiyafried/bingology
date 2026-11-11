import { loadSeen } from "./seen.js";

export const MIGRATED_KEY = "bingology:migrated";

/** Local "seen" marks as account rows, minus tmdb ids already in the account. Never throws. */
export function seenToEntries(storage, S, existing) {
  return [...loadSeen(storage, S)]
    .map(i => S[i])
    .filter(s => !existing.has(s.tmdbId))
    .map(s => ({ tmdb_id: s.tmdbId, status: "seen", title: s.n, poster: s.poster }));
}
