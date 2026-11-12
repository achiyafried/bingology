import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEntry, validateData, shouldAbort, sameData } from "../scripts/lib/merge.mjs";

const NOW = "2026-11-10T03:00:00Z";
const entry = {
  tmdbId: 1396, name: "Breaking Bad", lists: ["mine", "nyt"], nytRank: 1,
  genres: ["crime"], moods: ["tense"], weight: 3, solo: false, blurb: "מורה לכימיה", rt: 96,
  fallback: { year: 2008, seasons: 5, episodes: 62, runtime: 47, imdb: 9.5, lang: "en" },
};
const live = {
  year: 2008, seasons: 6, episodes: 70, runtime: 48, status: "ended", lang: "en",
  poster: "https://image.tmdb.org/t/p/w342/p.jpg", creators: ["Vince Gilligan"],
  cast: [{ name: "Bryan Cranston", photo: null }], providers: ["netflix"], overviewHe: "תקציר", imdbId: "tt0903747",
};
const prev = { ...entry, year: 2008, seasons: 5, episodes: 62, runtime: 50, status: "ended", imdb: 9.4, lang: "en",
  poster: "https://old.jpg", creators: ["VG"], cast: [], providers: ["hbo"], overviewHe: null, fetchedAt: "2026-11-09T03:00:00Z" };
delete prev.fallback;

test("live values win and manual fields come from the entry", () => {
  const s = mergeEntry(entry, { ...live }, 9.5, prev, NOW);
  assert.equal(s.seasons, 6);
  assert.equal(s.name, "Breaking Bad");
  assert.equal(s.rt, 96);
  assert.equal(s.imdb, 9.5);
  assert.deepEqual(s.providers, ["netflix"]);
  assert.equal(s.fetchedAt, NOW);
  assert.equal("fallback" in s, false);
  assert.equal("imdbId" in s, false);
});

test("without live data the previous values are kept", () => {
  const s = mergeEntry(entry, null, null, prev, NOW);
  assert.equal(s.runtime, 47); // curated runtime beats last night's
  assert.equal(s.imdb, 9.4);
  assert.deepEqual(s.providers, ["hbo"]);
  assert.equal(s.fetchedAt, "2026-11-09T03:00:00Z");
});

test("without live or previous data the fallback is used", () => {
  const s = mergeEntry(entry, null, null, null, NOW);
  assert.equal(s.seasons, 5);
  assert.equal(s.runtime, 47);
  assert.equal(s.imdb, 9.5);
  assert.deepEqual(s.providers, []);
  assert.deepEqual(s.cast, []);
  assert.equal(s.poster, null);
  assert.equal(s.fetchedAt, null);
});

test("a missing live field falls back per field", () => {
  const s = mergeEntry(entry, { ...live, runtime: null, poster: null }, null, prev, NOW);
  assert.equal(s.runtime, 47); // curated runtime beats last night's
  assert.equal(s.poster, "https://old.jpg");
  assert.equal(s.imdb, 9.4);
  assert.equal(s.seasons, 6);
});

test("live empty providers are kept (series left Israeli streaming)", () => {
  const s = mergeEntry(entry, { ...live, providers: [] }, 9.5, prev, NOW);
  assert.deepEqual(s.providers, []);
});

test("validateData accepts good data and flags bad series and count", () => {
  const good = { updatedAt: NOW, series: [mergeEntry(entry, live, 9.5, null, NOW)] };
  assert.deepEqual(validateData(good, 1), []);
  const bad = { updatedAt: NOW, series: [{ ...good.series[0], seasons: 0 }] };
  assert.ok(validateData(bad, 1).some(e => e.includes("seasons")));
  assert.ok(validateData(good, 2).some(e => e.includes("count")));
  assert.ok(validateData({ series: [{ ...good.series[0], imdb: 11 }] }, 1).some(e => e.includes("imdb")));
});

test("shouldAbort above 20% failures", () => {
  assert.equal(shouldAbort(25, 128), false);
  assert.equal(shouldAbort(26, 128), true);
});

test("sameData ignores timestamps only", () => {
  const a = { updatedAt: "x", series: [{ imdb: 9, fetchedAt: "1" }] };
  assert.equal(sameData(a, { updatedAt: "y", series: [{ imdb: 9, fetchedAt: "2" }] }), true);
  assert.equal(sameData(a, { updatedAt: "y", series: [{ imdb: 8, fetchedAt: "1" }] }), false);
  assert.equal(sameData(a, null), false);
});

test("validateData allows a missing IMDb score but rejects a non-number", () => {
  const s = mergeEntry({ ...entry, fallback: { ...entry.fallback, imdb: null } }, null, null, null, NOW);
  assert.deepEqual(validateData({ series: [s] }, 1), []);
  assert.ok(validateData({ series: [{ ...s, imdb: "9.1" }] }, 1).some(e => e.includes("imdb")));
});

test("cast and creators fall back to the legacy lists when nothing better exists", () => {
  const fb = { ...entry.fallback, cast: [{ name: "Bryan Cranston", photo: null }], creators: ["Vince Gilligan"] };
  const e2 = { ...entry, fallback: fb };
  assert.deepEqual(mergeEntry(e2, null, null, null, NOW).cast, fb.cast);
  assert.deepEqual(mergeEntry(e2, null, null, { ...prev, cast: [], creators: [] }, NOW).creators, ["Vince Gilligan"]);
  assert.deepEqual(mergeEntry(e2, { ...live, cast: [] }, 9.5, null, NOW).cast, fb.cast);
  assert.deepEqual(mergeEntry(e2, live, 9.5, null, NOW).cast, live.cast);
  assert.deepEqual(mergeEntry(e2, { ...live, providers: [] }, 9.5, prev, NOW).providers, []);
});

test("providers fall back to the legacy platform only when never fetched", () => {
  const e2 = { ...entry, fallback: { ...entry.fallback, providers: ["netflix"] } };
  assert.deepEqual(mergeEntry(e2, null, null, null, NOW).providers, ["netflix"]);
  assert.deepEqual(mergeEntry(e2, null, null, { ...prev, providers: [], fetchedAt: null }, NOW).providers, ["netflix"]);
  assert.deepEqual(mergeEntry(e2, null, null, { ...prev, providers: [], fetchedAt: "2026-11-09T03:00:00Z" }, NOW).providers, []);
  assert.deepEqual(mergeEntry(e2, { ...live, providers: [] }, 9.5, null, NOW).providers, []);
});

test("status is null when unknown (never fetched), not guessed as ended", () => {
  assert.equal(mergeEntry(entry, null, null, null, NOW).status, null);
});

test("a previous entry that was never fetched carries no live information", () => {
  const stale = { ...prev, status: "ended", poster: "https://x", fetchedAt: null };
  const s = mergeEntry(entry, null, null, stale, NOW);
  assert.equal(s.status, null);
  assert.equal(s.poster, null);
  assert.equal(s.runtime, 47);
});

test("TMDB votes come from live, then a real previous fetch", () => {
  assert.equal(mergeEntry(entry, { ...live, tmdbVote: 8.9, tmdbVotes: 100 }, 9.5, null, NOW).tmdbVote, 8.9);
  assert.equal(mergeEntry(entry, null, null, { ...prev, tmdbVote: 8.1, tmdbVotes: 50 }, NOW).tmdbVotes, 50);
  assert.equal(mergeEntry(entry, null, null, null, NOW).tmdbVote, null);
});

test("runtime: typical length, then the curated value, then previous, then the last episode", () => {
  assert.equal(mergeEntry(entry, { ...live, runtime: 52 }, 9.5, prev, NOW).runtime, 52);
  assert.equal(mergeEntry(entry, { ...live, runtime: null, runtimeLast: 80 }, 9.5, prev, NOW).runtime, 47);
  const noFb = { ...entry, fallback: { ...entry.fallback, runtime: null } };
  assert.equal(mergeEntry(noFb, { ...live, runtime: null, runtimeLast: 80 }, 9.5, prev, NOW).runtime, 50);
  assert.equal(mergeEntry(noFb, { ...live, runtime: null, runtimeLast: 80 }, 9.5, null, NOW).runtime, 80);
});

test("minAge comes from live, then a real previous fetch", () => {
  assert.equal(mergeEntry(entry, { ...live, minAge: 14 }, 9.5, null, NOW).minAge, 14);
  assert.equal(mergeEntry(entry, null, null, { ...prev, minAge: 17 }, NOW).minAge, 17);
  assert.equal(mergeEntry(entry, null, null, null, NOW).minAge, null);
});

test("manual extraProviders are added to live providers, without duplicates", () => {
  const e2 = { ...entry, extraProviders: ["israel", "netflix"] };
  const s = mergeEntry(e2, { ...live, providers: ["netflix"], providersGuess: [] }, 9.5, null, NOW);
  assert.deepEqual(s.providers, ["netflix", "israel"]);
  assert.deepEqual(s.extraProviders, ["israel", "netflix"]);
  assert.deepEqual(mergeEntry(e2, null, null, null, NOW).providers, ["israel", "netflix"]);
});

test("providersGuess follows the live data, else a real previous fetch", () => {
  assert.deepEqual(mergeEntry(entry, { ...live, providersGuess: ["disney"] }, 9.5, null, NOW).providersGuess, ["disney"]);
  assert.deepEqual(mergeEntry(entry, null, null, { ...prev, providersGuess: ["disney"] }, NOW).providersGuess, ["disney"]);
  assert.deepEqual(mergeEntry(entry, null, null, null, NOW).providersGuess, []);
});

test("providersOther follows the live data, else a real previous fetch", () => {
  assert.deepEqual(mergeEntry(entry, { ...live, providersOther: ["Rakuten Viki"] }, 9.5, null, NOW).providersOther, ["Rakuten Viki"]);
  assert.deepEqual(mergeEntry(entry, null, null, { ...prev, providersOther: ["Shahid VIP"] }, NOW).providersOther, ["Shahid VIP"]);
  assert.deepEqual(mergeEntry(entry, null, null, null, NOW).providersOther, []);
});

test("seasonEps keeps last night's value when live has none", () => {
  const p = { ...prev, seasonEps: [7, 13] };
  assert.deepEqual(mergeEntry(entry, { ...live, seasonEps: null }, null, p, NOW).seasonEps, [7, 13]);
  assert.deepEqual(mergeEntry(entry, { ...live, seasonEps: [8] }, null, p, NOW).seasonEps, [8]);
});

test("next and streams are live-only: copied from live, never kept from prev", () => {
  const nx = { season: 3, episode: 1, date: "2027-03-14" }, strm = { IL: ["Apple TV+"], US: [], UK: [] };
  const s = mergeEntry(entry, { ...live, next: nx, streams: strm }, 9.5, prev, NOW);
  assert.deepEqual(s.next, nx);
  assert.deepEqual(s.streams, strm);
  const off = mergeEntry(entry, null, null, { ...prev, next: nx, streams: strm }, NOW);
  assert.equal(off.next, null);
  assert.equal(off.streams, null);
});
