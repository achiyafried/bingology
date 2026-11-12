import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng, shuffle, pick, sample } from "../scripts/lib/games/rng.mjs";
import { buildPool, card, emptyRecent, KNOWN, GROUPS_KNOWN } from "../scripts/lib/games/pool.mjs";
import { GAMES, israelToday, addDays } from "../site/lib/games/day.js";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const take = (rng, n) => Array.from({ length: n }, rng);

test("makeRng is deterministic per seed", () => {
  assert.deepEqual(take(makeRng("a"), 5), take(makeRng("a"), 5));
  assert.notDeepEqual(take(makeRng("a"), 5), take(makeRng("b"), 5));
  for (const x of take(makeRng("z"), 100)) assert.ok(x >= 0 && x < 1);
});

test("shuffle, pick, sample", () => {
  const rng = makeRng("s");
  const arr = [1, 2, 3, 4, 5, 6];
  const sh = shuffle(rng, arr);
  assert.deepEqual([...sh].sort(), arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5, 6]);
  assert.ok(arr.includes(pick(rng, arr)));
  const s = sample(rng, arr, 4);
  assert.equal(new Set(s).size, 4);
  assert.equal(sample(rng, arr, 10).length, 6);
});

test("buildPool picks the most-voted known series", () => {
  assert.equal(KNOWN, 300);
  const pool = buildPool(fixtureSeries(), { known: 20 });
  assert.equal(pool.all.length, 60);
  assert.deepEqual(pool.known.map((s) => s.tmdbId), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(pool.knownIds.size, 20);
  assert.equal(pool.byId.get(33).name, "Series 33");
});

test("actorsKnown counts known series only, photo covers all", () => {
  const pool = buildPool(fixtureSeries(), { known: 5 });
  assert.deepEqual(pool.actorsKnown.get("Hub1 Actor"), [1, 2, 3, 4, 5]);
  assert.equal(pool.actorsKnown.has("Hub2 Actor"), false);
  assert.match(pool.photo.get("Hub2 Actor"), /^https:\/\/image\.tmdb\.org\/t\/p\/w185\/a\d+\.jpg$/);
});

test("series without tmdbId are dropped; card shape; emptyRecent", () => {
  const pool = buildPool([...fixtureSeries(), { tmdbId: null, name: "x", tmdbVotes: 99999 }], { known: 3 });
  assert.equal(pool.all.length, 60);
  assert.equal(pool.known[0].tmdbId, 1);
  assert.deepEqual(card({ tmdbId: 7, name: "N", poster: "/p.jpg", year: 1 }), { id: 7, name: "N", poster: "/p.jpg" });
  assert.deepEqual(card({ tmdbId: 7, name: "N" }), { id: 7, name: "N", poster: null });
  const r = emptyRecent();
  for (const k of ["series", "actors", "pairs", "oddActors", "groups"]) assert.ok(r[k] instanceof Set, k);
});

test("israelToday and addDays", () => {
  assert.equal(israelToday(new Date("2026-11-12T21:59:00Z")), "2026-11-12");
  assert.equal(israelToday(new Date("2026-11-12T22:01:00Z")), "2026-11-13");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("GAMES ids and order", () => {
  assert.deepEqual(GAMES.map((g) => g.id), ["guess", "odd", "chain", "groups", "blur"]);
  assert.equal(GAMES[3].name, "ארבע קבוצות");
});

test("fixture sanity: rich enough for generators with known = all 60", () => {
  const series = fixtureSeries();
  assert.equal(series.length, 60);
  const pool = buildPool(series, { known: 60 });
  assert.equal(pool.known.length, 60);
  assert.ok([...pool.actorsKnown.values()].some((ids) => ids.length >= 4));
  const count = (f) => {
    const m = new Map();
    for (const s of series) for (const k of [].concat(f(s))) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  assert.ok([...count((s) => s.creators).values()].some((n) => n >= 4));
  assert.ok([...count((s) => s.year).values()].some((n) => n >= 4));
  assert.ok(count((s) => s.lang).get("ko") >= 4);
  assert.ok(series.every((s) => s.cast.length === 6 && s.cast.every((c) => c.photo)));

  // BFS over series, one hop = sharing an actor
  const nbrs = (id) => new Set(pool.byId.get(id).cast.flatMap((c) => pool.actorsKnown.get(c.name)).filter((x) => x !== id));
  const dists = new Set();
  for (let a = 1; a <= 60; a++) {
    const d = new Map([[a, 0]]);
    const q = [a];
    while (q.length) {
      const x = q.shift();
      for (const y of nbrs(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); q.push(y); }
    }
    assert.equal(d.size, 60, `series ${a} reaches all`);
    for (const v of d.values()) dists.add(v);
  }
  assert.equal(Math.max(...dists), 3);
  assert.ok(dists.has(2) && dists.has(3));
});

test("wide pool: top GROUPS_KNOWN (600) by votes, independent of known", () => {
  assert.equal(GROUPS_KNOWN, 600);
  const many = Array.from({ length: 700 }, (_, i) => ({ tmdbId: i + 1, name: `S${i}`, tmdbVotes: i, cast: [] }));
  const p = buildPool(many, { known: 3 });
  assert.equal(p.wide.length, 600);
  assert.equal(p.wide[0].tmdbId, 700);
  assert.equal(p.wide.at(-1).tmdbId, 101);
  assert.equal(buildPool(fixtureSeries(), { known: 3 }).wide.length, 60);
});
