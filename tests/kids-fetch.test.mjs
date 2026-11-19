import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../scripts/fetch-kids.mjs";

process.env.TMDB_TOKEN = "t";
const NOW = "2026-11-19T03:00:00Z";
const map = { netflix: ["Netflix"], disney: ["Disney Plus"] };
const show = (id, rating = "TV-Y") => ({
  id, name: `Show ${id}`, poster_path: `/${id}.jpg`, first_air_date: "2020-01-01", number_of_seasons: 2,
  overview: "EN", vote_average: 7, vote_count: 5,
  content_ratings: { results: [{ iso_3166_1: "US", rating }] },
  "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Netflix" }] } } },
});

/** Fake TMDB: `fail` = ids answering 500; `rating` = per-id US rating. */
function fake({ fail = new Set(), rating = {} } = {}) {
  const calls = [];
  const f = async url => {
    const u = new URL(url); calls.push(u.pathname);
    const m = /\/tv\/(\d+)$/.exec(u.pathname);
    if (!m) return new Response("{}", { status: 404 });
    const id = +m[1];
    if (fail.has(id)) return new Response("{}", { status: 500 });
    if (u.searchParams.get("language") === "he-IL") return new Response(JSON.stringify({ id, name: `סדרה ${id}`, overview: "תקציר" }));
    return new Response(JSON.stringify(show(id, rating[id])));
  };
  f.calls = calls;
  return f;
}

test("maps rows and lets the hand-written Hebrew name win", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "mid", he: "שם ידני" }, { tmdb: 2, age: "small" }], prev: null, fetchImpl: fake(), now: NOW, map });
  assert.equal(r.abort, false);
  assert.equal(r.data.updatedAt, NOW);
  const [a, b] = r.data.items;
  assert.equal(a.nameHe, "שם ידני");
  assert.equal(a.age, "mid");
  assert.equal(a.tmdb, 1);
  assert.equal(a.fetchedAt, NOW);
  assert.deepEqual(a.providers, ["netflix"]);
  assert.equal(b.nameHe, "סדרה 2");
});

test("a failed row keeps yesterday's details with today's age", async () => {
  const prev = { items: [{ tmdb: 2, age: "small", name: "Old", nameHe: "ישן", poster: null, minAge: 0, providers: [] }] };
  const r = await run({ rows: [{ tmdb: 1, age: "mid" }, { tmdb: 2, age: "mid" }], prev, fetchImpl: fake({ fail: new Set([2]) }), now: NOW, map });
  const old = r.data.items.find(x => x.tmdb === 2);
  assert.equal(old.name, "Old");
  assert.equal(old.age, "mid");
  assert.equal(r.failed, 1);
});

test("a new row that fails is left out", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "mid" }, { tmdb: 2, age: "mid" }, { tmdb: 3, age: "mid" }, { tmdb: 4, age: "mid" }, { tmdb: 5, age: "mid" }], prev: null, fetchImpl: fake({ fail: new Set([2]) }), now: NOW, map });
  assert.deepEqual(r.data.items.map(x => x.tmdb), [1, 3, 4, 5]);
  assert.equal(r.failed, 1);
  assert.equal(r.abort, false);
});

test("drops a series above its group's cap", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "small" }, { tmdb: 2, age: "big" }], prev: null, fetchImpl: fake({ rating: { 1: "TV-PG", 2: "TV-PG" } }), now: NOW, map });
  assert.deepEqual(r.data.items.map(x => x.tmdb), [2]);
  assert.ok(r.warnings.some(w => /^1: .*above the small cap/.test(w)), r.warnings.join(" | "));
});

test("more than 20% failures aborts", async () => {
  const rows = [1, 2, 3, 4, 5].map(tmdb => ({ tmdb, age: "mid" }));
  assert.equal((await run({ rows, prev: null, fetchImpl: fake({ fail: new Set([1, 2]) }), now: NOW, map })).abort, true);
  assert.equal((await run({ rows, prev: null, fetchImpl: fake({ fail: new Set([1]) }), now: NOW, map })).abort, false);
});

test("bad rows are skipped with a warning", async () => {
  const f = fake();
  const r = await run({ rows: [{ tmdb: "x", age: "mid" }, { tmdb: 7, age: "mid" }], prev: null, fetchImpl: f, now: NOW, map });
  assert.ok(r.warnings.some(w => w.startsWith("kids.json row 0")), r.warnings.join(" | "));
  assert.deepEqual(r.data.items.map(x => x.tmdb), [7]);
  assert.ok(f.calls.every(p => !p.includes("/x")));
});
