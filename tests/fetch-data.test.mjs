import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../scripts/fetch-data.mjs";
import { omdbRating, pool } from "../scripts/lib/api.mjs";
import { writeNews } from "../scripts/lib/news.mjs";

process.env.TMDB_TOKEN = "t";
process.env.OMDB_KEY = "k";
const bb = JSON.parse(readFileSync("tests/fixtures/tv-1396-he.json", "utf8"));
const NOW = "2026-11-10T03:00:00Z";
const entry = (id, name) => ({ tmdbId: id, name, lists: ["mine"], genres: ["drama"], moods: ["feel"], weight: 2, solo: false, blurb: "",
  rt: null, fallback: { year: 2000, seasons: 2, episodes: 20, runtime: 45, imdb: 8.1, lang: "en" } });

/** Fake network: `tv` maps id → fixture object | HTTP status number | "net" (network error). */
function fakeFetch({ tv = {}, imdb = "9.5", discover = null } = {}) {
  const calls = [];
  const f = async url => {
    url = String(url); calls.push(url);
    if (url.includes("omdbapi.com")) return new Response(JSON.stringify({ Response: "True", imdbRating: imdb }));
    if (url.includes("/discover/tv")) {
      if (discover === "net") throw new TypeError("fetch failed");
      const sp = new URL(url).searchParams, page = Number(sp.get("page"));
      const pages = Array.isArray(discover) ? discover : (discover?.[sp.get("vote_average.gte")] || []);
      return new Response(JSON.stringify({ page, total_pages: pages.length, results: pages[page - 1] || [] }));
    }
    const id = Number(/\/tv\/(\d+)/.exec(url)[1]);
    const v = tv[id];
    if (v === "net") throw new TypeError("fetch failed");
    if (typeof v === "number") return new Response("{}", { status: v });
    return new Response(JSON.stringify({ ...bb, ...(v || {}), id }));
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

test("omdbRating: undefined when the request failed (network, quota), null when OMDb has no rating", async () => {
  assert.equal(await omdbRating("tt1", async () => { throw new TypeError("x"); }), undefined);
  assert.equal(await omdbRating("tt1", async () => new Response(JSON.stringify({ Response: "False", Error: "Request limit reached!" }))), undefined);
  assert.equal(await omdbRating("tt1", async () => new Response("{}", { status: 500 })), undefined);
  assert.equal(await omdbRating("tt1", async () => new Response(JSON.stringify({ Response: "True", imdbRating: "N/A" }))), null);
  assert.equal(await omdbRating("tt1", async () => new Response(JSON.stringify({ Response: "True", imdbRating: "8.3" }))), 8.3);
  assert.equal(await omdbRating(null, async () => { throw new Error("must not call"); }), null);
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

const d = (id, va = 8.5, vc = 2000) => ({ id, vote_average: va, vote_count: vc, genre_ids: [35] });
const manyCast = { aggregate_credits: { cast: Array.from({ length: 12 }, (_, k) => ({ name: "Actor " + k, order: k, profile_path: null })) } };

test("the wide pool is discovered, tagged from genres and appended after the curated series", async () => {
  const f = fakeFetch({ discover: [[d(1), d(101), d(102)], [d(103)]], tv: { 101: { ...manyCast, genres: [{ id: 35 }], name: "Pool Comedy" } } });
  const r = await run({ series: [entry(1, "A")], prev: null, fetchImpl: f, now: NOW, poolSize: 2 });
  assert.equal(r.abort, false, JSON.stringify(r.errors));
  assert.equal(r.data.series.length, 3);
  const pool = r.data.series.slice(1);
  assert.ok(pool.every(s => s.lists[0] === "pool"));
  assert.ok(!pool.some(s => s.tmdbId === 1), "curated id must not be in the pool");
  const comedy = pool.find(s => s.tmdbId === 101);
  assert.deepEqual(comedy.genres, ["comedy"]);
  assert.equal(comedy.cast.length, 8);
});

test("a pool series that fails is skipped without aborting the run", async () => {
  const f = fakeFetch({ discover: [[d(101), d(102), d(103)]], tv: { 102: 404 } });
  const r = await run({ series: [entry(1, "A")], prev: null, fetchImpl: f, now: NOW, poolSize: 3 });
  assert.equal(r.abort, false);
  assert.deepEqual(r.data.series.map(s => s.tmdbId).sort((a, b) => a - b), [1, 101, 103]);
});

test("if discovery fails, last night's pool is kept", async () => {
  const prevPool = { ...entry(500, "Old Pool"), lists: ["pool"], seasons: 2, episodes: 10, runtime: 40, year: 2010, lang: "en", imdb: 8, status: "ended", poster: null, creators: [], cast: [], providers: [], fetchedAt: "old" };
  delete prevPool.fallback;
  const f = fakeFetch({ discover: "net" });
  const r = await run({ series: [entry(1, "A")], prev: { series: [prevPool] }, fetchImpl: f, now: NOW, poolSize: 5 });
  assert.equal(r.abort, false);
  assert.deepEqual(r.data.series.map(s => s.name), ["A", "Old Pool"]);
  assert.ok(r.warnings.some(w => w.includes("discover")));
});

test("pool blurbs from the hand-written file apply to fetched and kept pool series alike", async () => {
  const prevPool = { ...entry(500, "Old Pool"), lists: ["pool"], blurb: "", seasons: 2, episodes: 10, runtime: 40, year: 2010, lang: "en", imdb: 8, status: "ended", poster: null, creators: [], cast: [], providers: [], fetchedAt: "old" };
  delete prevPool.fallback;
  const kept = await run({ series: [entry(1, "A")], prev: { series: [prevPool] }, fetchImpl: fakeFetch({ discover: "net" }), now: NOW, poolSize: 5, blurbs: { 500: "תיאור ישן." } });
  assert.equal(kept.data.series[1].blurb, "תיאור ישן.");
  const fresh = await run({ series: [entry(1, "A")], prev: null, fetchImpl: fakeFetch({ discover: [[d(101)]] }), now: NOW, poolSize: 1, blurbs: { 101: "תיאור חדש." } });
  assert.equal(fresh.data.series[1].blurb, "תיאור חדש.");
});

test("offline keeps the previous pool and never calls the network", async () => {
  const prevPool = { tmdbId: 500, name: "Old Pool", lists: ["pool"], genres: ["drama"], moods: ["feel"], weight: 2, solo: false, blurb: "", rt: null, seasons: 2, episodes: 10, runtime: 40, imdb: 8, fetchedAt: "old" };
  const f = fakeFetch();
  const r = await run({ series: [entry(1, "A")], prev: { series: [prevPool] }, fetchImpl: f, now: NOW, poolSize: 5, offline: true });
  assert.deepEqual(r.data.series.map(s => s.name), ["A", "Old Pool"]);
  assert.equal(f.calls.length, 0);
});

test("pool series under 7.5 on IMDb are left out; unknown IMDb is kept", async () => {
  const f = async url => {
    url = String(url);
    if (url.includes("/discover/tv")) return new Response(JSON.stringify({ page: 1, total_pages: 1, results: [d(201), d(202), d(203)] }));
    if (url.includes("omdbapi.com")) {
      const id = new URL(url).searchParams.get("i");
      return new Response(JSON.stringify(id === "tt201" ? { imdbRating: "7.2" } : id === "tt202" ? { imdbRating: "8.4" } : { imdbRating: "N/A" }));
    }
    const id = Number(/\/tv\/(\d+)/.exec(url)[1]);
    return new Response(JSON.stringify({ ...bb, id, external_ids: { imdb_id: "tt" + id }, episode_run_time: [40] }));
  };
  const r = await run({ series: [], prev: null, fetchImpl: f, now: NOW, poolSize: 3 });
  assert.deepEqual(r.data.series.map(s => s.tmdbId).sort(), [202, 203]);
});

test("the pool is topped up from extra candidates when some are filtered out", async () => {
  const f = async url => {
    url = String(url);
    if (url.includes("/discover/tv")) return new Response(JSON.stringify({ page: 1, total_pages: 1, results: [d(301, 9.0), d(302, 8.9), d(303, 8.8)] }));
    if (url.includes("omdbapi.com")) return new Response(JSON.stringify({ imdbRating: new URL(url).searchParams.get("i") === "tt301" ? "6.0" : "8.0" }));
    const id = Number(/\/tv\/(\d+)/.exec(url)[1]);
    return new Response(JSON.stringify({ ...bb, id, external_ids: { imdb_id: "tt" + id }, episode_run_time: [40] }));
  };
  const r = await run({ series: [], prev: null, fetchImpl: f, now: NOW, poolSize: 2 });
  assert.deepEqual(r.data.series.map(s => s.tmdbId), [302, 303]);
});

test("keepPool refreshes curated series only and keeps last night's pool, minus anything now curated", async () => {
  const mk = (id, name) => ({ tmdbId: id, name, lists: ["pool"], genres: ["drama"], moods: ["feel"], weight: 2, solo: false, blurb: "", rt: null, seasons: 1, episodes: 8, runtime: 50, imdb: 8, fetchedAt: "old" });
  const prev = { series: [mk(700, "Stays"), mk(2, "Now Curated")] };
  const f = fakeFetch({ discover: "net" });
  const r = await run({ series: [entry(1, "A"), entry(2, "B")], prev, fetchImpl: f, now: NOW, poolSize: 500, keepPool: true });
  assert.deepEqual(r.data.series.map(s => s.name), ["A", "B", "Stays"]);
  assert.ok(!f.calls.some(u => u.includes("/discover/")));
});

const omdbCounter = () => { const f = fakeFetch(); return { f, n: () => f.calls.filter(u => u.includes("omdbapi.com")).length }; };
const prevWith = (imdbAt, imdb = 8.8) => ({ series: [{ tmdbId: 1, imdb, imdbAt, fetchedAt: "2026-11-09T03:00:00Z" }] });

test("a fresh IMDb score (under 3 days) is reused without calling OMDb", async () => {
  const { f, n } = omdbCounter();
  const r = await run({ series: [entry(1, "A")], prev: prevWith("2026-11-08T03:00:00Z"), fetchImpl: f, now: NOW });
  assert.equal(n(), 0);
  assert.equal(r.data.series[0].imdb, 8.8);
  assert.equal(r.data.series[0].imdbAt, "2026-11-08T03:00:00Z");
});

test("a stale IMDb score is refreshed and stamped", async () => {
  const { f, n } = omdbCounter();
  const r = await run({ series: [entry(1, "A")], prev: prevWith("2026-11-01T03:00:00Z"), fetchImpl: f, now: NOW });
  assert.equal(n(), 1);
  assert.equal(r.data.series[0].imdb, 9.5);
  assert.equal(r.data.series[0].imdbAt, NOW);
});

test("the OMDb budget caps calls; over budget keeps the old score and stamp", async () => {
  const { f, n } = omdbCounter();
  const series = [1, 2, 3].map(i => entry(i, "S" + i));
  const prev = { series: series.map(e => ({ tmdbId: e.tmdbId, imdb: 7.7, imdbAt: "2026-10-01T00:00:00Z", fetchedAt: "x" })) };
  const r = await run({ series, prev, fetchImpl: f, now: NOW, omdbBudget: 2 });
  assert.equal(n(), 2);
  assert.deepEqual(r.data.series.map(s => s.imdbAt), [NOW, NOW, "2026-10-01T00:00:00Z"]);
  assert.equal(r.data.series[2].imdb, 7.7);
});

test("discovery loosens the threshold only until there are enough candidates", async () => {
  const f = fakeFetch({ discover: { "7.5": [[d(11), d(12)]], "7.3": [[d(11), d(12), d(13), d(14)]], "7.2": [[d(99)]] } });
  const r = await run({ series: [], prev: null, fetchImpl: f, now: NOW, poolSize: 3 });
  assert.equal(r.data.series.length, 3);
  const tiers = f.calls.filter(u => u.includes("/discover/")).map(u => new URL(u).searchParams.get("vote_average.gte"));
  assert.deepEqual([...new Set(tiers)], ["7.5", "7.3"]);
});

test("news wiring: rows stamped by run() are diffed by writeNews only with the same now", async () => {
  const series = [entry(1, "A")];
  const prevRun = await run({ series, prev: null, fetchImpl: fakeFetch({ tv: { 1: { status: "Returning Series" } } }), now: NOW });
  const NOW2 = "2026-11-11T03:00:00Z";
  const ended = { status: "Ended", in_production: false, next_episode_to_air: null };
  const currRun = await run({ series, prev: prevRun.data, fetchImpl: fakeFetch({ tv: { 1: ended } }), now: NOW2 });
  assert.equal(currRun.data.series[0].fetchedAt, NOW2);
  const go = now => { const w = []; writeNews({ prevData: prevRun.data, data: currRun.data, newsPath: "n.json", now,
    read: () => null, write: (p, s) => w.push(s), warn: () => {} }); return w; };
  const same = go(NOW2);
  assert.equal(same.length, 1);
  assert.equal(JSON.parse(same[0]).items[0].kind, "ended");
  assert.equal(go("2026-11-11T03:00:05Z").length, 0); // a second timestamp silently drops every row
});
