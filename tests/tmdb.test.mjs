import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { medianRuntime, mapProviders, transformTv, minAgeOf } from "../scripts/lib/tmdb.mjs";

const json = p => JSON.parse(readFileSync(p, "utf8"));
const map = json("scripts/providers.json");
const bb = json("tests/fixtures/tv-1396-he.json");
const partial = json("tests/fixtures/tv-partial.json");

test("medianRuntime uses only the typical episode length, never the (often long) last episode", () => {
  assert.equal(medianRuntime({ episode_run_time: [45, 47, 60] }), 47);
  assert.equal(medianRuntime({ episode_run_time: [40, 50] }), 45);
  assert.equal(medianRuntime({ episode_run_time: [], last_episode_to_air: { runtime: 52 } }), null);
  assert.equal(medianRuntime({ episode_run_time: [] }), null);
});

test("mapProviders maps known names and sends unknown ones to other", () => {
  assert.deepEqual(mapProviders([{ provider_name: "Netflix" }, { provider_name: "Brand New TV" }], map),
    { cats: ["netflix", "other"], unknown: ["Brand New TV"] });
  assert.deepEqual(mapProviders([{ provider_name: "netflix" }, { provider_name: "Netflix basic with Ads" }], map),
    { cats: ["netflix"], unknown: [] });
});

test("transformTv maps a full response", () => {
  const { live } = transformTv(bb, { map, he: bb });
  assert.equal(live.year, 2008);
  assert.equal(live.seasons, 5);
  assert.equal(live.episodes, 62);
  assert.equal(live.runtime, 47);
  assert.equal(live.status, "ended");
  assert.equal(live.lang, "en");
  assert.match(live.poster, /^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
  assert.deepEqual(live.creators, ["Vince Gilligan"]);
  assert.deepEqual(live.cast.map(c => c.name), ["Bryan Cranston", "Aaron Paul", "Anna Gunn"]);
  assert.equal(live.cast[0].photo, "https://image.tmdb.org/t/p/w185/bryan.jpg");
  assert.equal(live.cast[2].photo, null);
  assert.deepEqual(live.providers, ["netflix"]);
  assert.equal(live.overviewHe, "מורה לכימיה שמאובחן בסרטן הופך ליצרן סמים.");
  assert.equal(live.imdbId, "tt0903747");
});

test("transformTv tolerates a partial response", () => {
  const { live } = transformTv(partial, { map });
  assert.equal(live.runtime, null);
  assert.equal(live.poster, null);
  assert.deepEqual(live.providers, []);
  assert.equal(live.imdbId, null);
  assert.equal(live.overviewHe, null);
  assert.equal(live.status, "airing");
});

test("transformTv reports unknown providers as warnings", () => {
  const tv = { ...bb, "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Mystery+" }] } } } };
  const { live, warnings } = transformTv(tv, { map });
  assert.deepEqual(live.providers, ["other"]);
  assert.ok(warnings.some(w => w.includes("Mystery+")));
});

test("cast is capped at 10", () => {
  const cast = Array.from({ length: 14 }, (_, i) => ({ name: "A" + i, order: i, profile_path: null }));
  assert.equal(transformTv({ ...bb, aggregate_credits: { cast } }, { map }).live.cast.length, 10);
});

test("transformTv maps TMDB status to airing / ended / canceled", () => {
  const st = (status, in_production = false) => transformTv({ ...bb, status, in_production }, { map }).live.status;
  assert.equal(st("Returning Series"), "airing");
  assert.equal(st("In Production"), "airing");
  assert.equal(st("Ended"), "ended");
  assert.equal(st("Canceled"), "canceled");
  assert.equal(st(undefined, true), "airing");
  assert.equal(st(undefined, false), "ended");
});

test("transformTv keeps the TMDB vote average and count", () => {
  const { live } = transformTv({ ...bb, vote_average: 8.912, vote_count: 15234 }, { map });
  assert.equal(live.tmdbVote, 8.9);
  assert.equal(live.tmdbVotes, 15234);
  const p = transformTv(partial, { map }).live;
  assert.equal(p.tmdbVote, null);
  assert.equal(p.tmdbVotes, null);
});

test("Apple's renamed service (Apple TV) maps to apple", () => {
  assert.deepEqual(mapProviders([{ provider_name: "Apple TV" }], map), { cats: ["apple"], unknown: [] });
});

test("the Hebrew overview comes only from the Hebrew response; the last episode length is kept separately", () => {
  const en = { ...bb, overview: "A chemistry teacher...", episode_run_time: [], last_episode_to_air: { runtime: 75 } };
  const { live } = transformTv(en, { map, he: { overview: "תקציר בעברית" } });
  assert.equal(live.overviewHe, "תקציר בעברית");
  assert.equal(live.runtime, null);
  assert.equal(live.runtimeLast, 75);
  assert.equal(transformTv(en, { map }).live.overviewHe, null);
});

test("minAgeOf reads the US TV rating, falling back to any country", () => {
  const cr = list => ({ content_ratings: { results: list } });
  assert.equal(minAgeOf(cr([{ iso_3166_1: "DE", rating: "16" }, { iso_3166_1: "US", rating: "TV-MA" }])), 17);
  assert.equal(minAgeOf(cr([{ iso_3166_1: "US", rating: "TV-14" }])), 14);
  assert.equal(minAgeOf(cr([{ iso_3166_1: "US", rating: "TV-PG" }])), 10);
  assert.equal(minAgeOf(cr([{ iso_3166_1: "US", rating: "TV-G" }])), 0);
  assert.equal(minAgeOf(cr([{ iso_3166_1: "GB", rating: "15" }])), 15);
  assert.equal(minAgeOf(cr([])), null);
  assert.equal(minAgeOf({}), null);
});

test("transformTv includes the minimum age", () => {
  const tv = { ...bb, content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-14" }] } };
  assert.equal(transformTv(tv, { map }).live.minAge, 14);
});

test("Disney+ is guessed from US Disney Plus / Hulu when TMDB has nothing for Israel", () => {
  const wp = (il, us) => ({ ...bb, "watch/providers": { results: { IL: { flatrate: il.map(n => ({ provider_name: n })) }, US: { flatrate: us.map(n => ({ provider_name: n })) } } } });
  let live = transformTv(wp([], ["Disney Plus", "Hulu"]), { map }).live;
  assert.deepEqual(live.providers, ["disney"]);
  assert.deepEqual(live.providersGuess, ["disney"]);
  live = transformTv(wp(["Netflix"], ["Hulu"]), { map }).live;
  assert.deepEqual(live.providers, ["netflix", "disney"]);
  assert.deepEqual(live.providersGuess, ["disney"]);
  live = transformTv(wp(["Disney Plus"], ["Disney Plus"]), { map }).live;
  assert.deepEqual(live.providers, ["disney"]);
  assert.deepEqual(live.providersGuess, []);
  live = transformTv(wp(["Netflix"], ["Netflix"]), { map }).live;
  assert.deepEqual(live.providersGuess, []);
});

test("cast is ranked by episodes appeared in, falling back to TMDB order", () => {
  const cast = [
    { name: "Anna Torv", order: 0, total_episode_count: 100, profile_path: null },
    { name: "Lance Reddick", order: 2, total_episode_count: 60, profile_path: null },
    { name: "John Noble", order: 7, total_episode_count: 99, profile_path: null },
    { name: "Guest", order: 1, total_episode_count: 3, profile_path: null },
  ];
  const { live } = transformTv({ ...bb, aggregate_credits: { cast } }, { map });
  assert.deepEqual(live.cast.map(c => c.name), ["Anna Torv", "John Noble", "Lance Reddick", "Guest"]);
});
