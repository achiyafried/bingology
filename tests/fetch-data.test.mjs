import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../scripts/fetch-data.mjs";
import { omdbRating, pool } from "../scripts/lib/api.mjs";

process.env.TMDB_TOKEN = "t";
process.env.OMDB_KEY = "k";
const bb = JSON.parse(readFileSync("tests/fixtures/tv-1396-he.json", "utf8"));
const NOW = "2026-11-10T03:00:00Z";
const entry = (id, name) => ({ tmdbId: id, name, lists: ["mine"], genres: ["drama"], moods: ["feel"], weight: 2, solo: false, blurb: "",
  rt: null, fallback: { year: 2000, seasons: 2, episodes: 20, runtime: 45, imdb: 8.1, lang: "en" } });

/** Fake network: `tv` maps id → fixture object | HTTP status number | "net" (network error). */
function fakeFetch({ tv = {}, imdb = "9.5" } = {}) {
  const calls = [];
  const f = async url => {
    url = String(url); calls.push(url);
    if (url.includes("omdbapi.com")) return new Response(JSON.stringify({ Response: "True", imdbRating: imdb }));
    const id = Number(/\/tv\/(\d+)/.exec(url)[1]);
    const v = tv[id];
    if (v === "net") throw new TypeError("fetch failed");
    if (typeof v === "number") return new Response("{}", { status: v });
    return new Response(JSON.stringify({ ...bb, id }));
  };
  f.calls = calls;
  return f;
}

test("all series succeed", async () => {
  const series = [entry(1, "A"), entry(2, "B")];
  const r = await run({ series, prev: null, fetchImpl: fakeFetch(), now: NOW });
  assert.equal(r.abort, false);
  assert.equal(r.data.series.length, 2);
  assert.equal(r.data.series[0].imdb, 9.5);
  assert.equal(r.data.series[0].seasons, 5);
  assert.equal(r.data.updatedAt, NOW);
});

test("more than 20% failures aborts", async () => {
  const series = [1, 2, 3, 4, 5].map(i => entry(i, "S" + i));
  const r = await run({ series, prev: null, fetchImpl: fakeFetch({ tv: { 2: 404, 4: 404 } }), now: NOW });
  assert.equal(r.abort, true);
  assert.deepEqual(r.failed, ["S2", "S4"]);
});

test("a single failure keeps the previous values", async () => {
  const series = [1, 2, 3, 4, 5].map(i => entry(i, "S" + i));
  const prev = { updatedAt: "x", series: series.map(e => ({ ...e, fallback: undefined, seasons: 9, episodes: 90, runtime: 30, imdb: 7, year: 2001, lang: "en", status: "ended", poster: null, creators: [], cast: [], providers: [], overviewHe: null, fetchedAt: "old" })) };
  const r = await run({ series, prev, fetchImpl: fakeFetch({ tv: { 3: 404 } }), now: NOW });
  assert.equal(r.abort, false);
  assert.equal(r.data.series[2].seasons, 9);
  assert.equal(r.data.series[2].fetchedAt, "old");
  assert.equal(r.data.series[0].seasons, 5);
});

test("TMDB unreachable aborts", async () => {
  const series = [1, 2, 3, 4].map(i => entry(i, "S" + i));
  const r = await run({ series, prev: null, fetchImpl: fakeFetch({ tv: { 1: "net", 2: "net", 3: "net", 4: "net" } }), now: NOW });
  assert.equal(r.abort, true);
});

test("offline mode uses fallback and never calls the network", async () => {
  const f = fakeFetch();
  const r = await run({ series: [entry(1, "A")], prev: null, fetchImpl: f, now: NOW, offline: true });
  assert.equal(r.abort, false);
  assert.equal(r.data.series[0].seasons, 2);
  assert.equal(f.calls.length, 0);
});

test("OMDb N/A keeps the previous rating", async () => {
  const series = [entry(1, "A")];
  const prev = { series: [{ tmdbId: 1, imdb: 8.8, fetchedAt: "2026-11-09T03:00:00Z" }] };
  const r = await run({ series, prev, fetchImpl: fakeFetch({ imdb: "N/A" }), now: NOW });
  assert.equal(r.data.series[0].imdb, 8.8);
});

test("only=N limits the run", async () => {
  const series = [1, 2, 3, 4].map(i => entry(i, "S" + i));
  const r = await run({ series, prev: null, fetchImpl: fakeFetch(), now: NOW, only: 2 });
  assert.equal(r.data.series.length, 2);
});

test("omdbRating returns null on network errors", async () => {
  assert.equal(await omdbRating("tt1", async () => { throw new TypeError("x"); }), null);
});

test("pool respects the concurrency limit and keeps order", async () => {
  let active = 0, max = 0;
  const out = await pool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async n => {
    active++; max = Math.max(max, active);
    await new Promise(r => setTimeout(r, 5));
    active--; return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  assert.equal(max, 3);
});

test("names come from an English request and the overview from a Hebrew one", async () => {
  const f = fakeFetch();
  await run({ series: [entry(1, "A")], prev: null, fetchImpl: f, now: NOW });
  const tv = f.calls.filter(u => u.includes("/tv/1"));
  assert.ok(tv.some(u => u.includes("language=en-US") && u.includes("append_to_response")), tv.join("\n"));
  assert.ok(tv.some(u => u.includes("language=he-IL") && !u.includes("append_to_response")), tv.join("\n"));
});
