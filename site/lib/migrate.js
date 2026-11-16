import { loadSeen } from "./seen.js";
import { loadNope } from "./nope.js";

export const MIGRATED_KEY = "bingology:migrated";

/** Local "seen" marks as account rows, minus tmdb ids already in the account. Never throws. */
export function seenToEntries(storage, S, existing) {
  return [...loadSeen(storage, S)]
    .map(i => S[i])
    .filter(s => !existing.has(s.tmdbId))
    .map(s => ({ tmdb_id: s.tmdbId, status: "seen", title: s.n, poster: s.poster }));
}

/** Local "not for me" marks as account rows, minus tmdb ids already in the account. Never throws. */
export function nopeToEntries(storage, S, existing) {
  return [...loadNope(storage, S)]
    .map(i => S[i])
    .filter(s => !existing.has(s.tmdbId))
    .map(s => ({ tmdb_id: s.tmdbId, status: "nope", title: s.n, poster: s.poster }));
}
