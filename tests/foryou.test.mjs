import { test } from "node:test";
import assert from "node:assert/strict";
import { readiness, forYou, unrated, forYouKey, memoForYou } from "../site/lib/foryou.js";

const mk = (id, o = {}) => ({ tmdbId: id, n: "S" + id, creators: [], g: ["a"], mo: [], h: 2, lang: "en", providers: [], y: 2010, imdb: 8, bs: null, ...o });
const row = (status, rating = null, updated_at = "2026-01-01T00:00:00Z") => ({ status, rating, updated_at });
const E = o => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
const none = new Set();

test("readiness needs 3 ratings, one of them 8+", () => {
  assert.deepEqual(readiness(E({ 1: row("seen", 9), 2: row("seen", 7) })), { ready: false, need: 1 });
  assert.deepEqual(readiness(E({ 1: row("seen", 5), 2: row("seen", 6), 3: row("seen", 7) })), { ready: false, need: 1 });
  assert.deepEqual(readiness(E({ 1: row("seen", 5), 2: row("seen", 6), 3: row("seen", 9) })), { ready: true, need: 0 });
  assert.deepEqual(readiness(new Map()), { ready: false, need: 3 });
});

test("excludes anything with an entry row or a local seen mark", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a", "b"] }), mk(3, { g: ["a", "b"] }), mk(4, { g: ["a", "b"] })];
  const r = forYou(S, E({ 1: row("seen", 9), 2: row("want") }), new Set([2]));
  assert.deepEqual(r.map(x => x.i).sort(), [3]);
});

test("a loved series pulls up its neighbour, and the reason names it", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a", "b"] }), mk(3, { g: ["z"], h: 5 })];
  const r = forYou(S, E({ 1: row("seen", 9) }), none);
  assert.equal(r[0].i, 1);
  assert.deepEqual(r[0].because, [S[0].n]);
});

test("a dropped series pushes its neighbour below an unrelated one", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a", "b", "c", "d", "e"] }), mk(3, { g: ["b"] }), mk(4, { g: ["c", "d", "e"] })];
  assert.equal(forYou(S, E({ 1: row("seen", 8) }), none)[0].i, 1);
  const r = forYou(S, E({ 1: row("seen", 8), 4: row("dropped") }), none);
  assert.deepEqual(r.map(x => x.i), [2, 1]);
});

test("ignores entries whose tmdb id is not in S", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a", "b"] })];
  const r = forYou(S, E({ 1: row("seen", 9), 999: row("seen", 10), 998: row("nope") }), none);
  assert.deepEqual(r.map(x => x.i), [1]);
});

test("two equal contributors are both named, once each", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a", "b"] }), mk(3, { g: ["a", "b"] })];
  const r = forYou(S, E({ 1: row("seen", 9), 2: row("seen", 9) }), none);
  assert.equal(r.length, 1);
  assert.deepEqual([...r[0].because].sort(), ["S1", "S2"]);
});

test("a weak second contributor is not named", () => {
  const S = [mk(1, { g: ["a", "b"] }), mk(2, { g: ["a"], h: 5, y: 1990, lang: "x" }), mk(3, { g: ["a", "b"] })];
  const r = forYou(S, E({ 1: row("seen", 9), 2: row("seen", 8) }), none);
  assert.deepEqual(r[0].because, ["S1"]);
});

test("widens when the first pass is all taken", () => {
  const S = [mk(1, { g: ["a", "b", "c"] }), mk(2, { g: ["a", "b", "c"] }), mk(3, { g: ["a"] })];
  const en = E({ 1: row("seen", 9), 2: row("want") });
  assert.deepEqual(forYou(S, en, none, { n: 8, k: 1, wide: 1 }), []);
  assert.deepEqual(forYou(S, en, none, { n: 8, k: 1, wide: 3 }).map(x => x.i), [2]);
});

test("returns at most n, ties broken by bs", () => {
  const S = [mk(1, { g: ["a", "b"] }), ...[2, 3, 4, 5].map(id => mk(id, { g: ["a", "b"], bs: id }))];
  const r = forYou(S, E({ 1: row("seen", 9) }), none, { n: 2, k: 20, wide: 60 });
  assert.deepEqual(r.map(x => x.i), [4, 3]);
});

test("unrated lists seen rows without a rating, newest first", () => {
  const S = [mk(1), mk(2), mk(3), mk(4)];
  const en = E({ 1: row("seen", null, "2026-01-01"), 2: row("seen", null, "2026-03-01"), 3: row("seen", 7), 4: row("want", null, "2026-05-01"), 999: row("seen", null, "2026-06-01") });
  assert.deepEqual(unrated(S, en), [1, 0]);
  assert.deepEqual(unrated(S, en, 1), [1]);
});

test("forYouKey: same for the same rows in any order, changes with status, rating or hidden marks", () => {
  const a = forYouKey(E({ 1: row("seen", 9), 2: row("want") }), new Set([3]));
  assert.equal(a, forYouKey(E({ 2: row("want", null, "2027-01-01"), 1: row("seen", 9) }), new Set([3])), "updated_at does not matter");
  assert.notEqual(a, forYouKey(E({ 1: row("seen", 8), 2: row("want") }), new Set([3])));
  assert.notEqual(a, forYouKey(E({ 1: row("seen", 9), 2: row("nope") }), new Set([3])));
  assert.notEqual(a, forYouKey(E({ 1: row("seen", 9), 2: row("want") }), new Set([3, 4])));
  assert.notEqual(a, forYouKey(E({ 1: row("seen", 9) }), new Set([3])));
});

test("memoForYou: recomputes only when S or the key changes, and returns forYou's result", () => {
  let calls = 0;
  const f = memoForYou((...a) => { calls++; return forYou(...a); });
  const S = [mk(1, { g: ["x"] }), mk(2, { g: ["x"] }), mk(3, { g: ["y"] }), mk(4), mk(5)];
  const ents = () => E({ 1: row("seen", 9), 4: row("seen", 8), 5: row("seen", 8) });
  assert.deepEqual(f(S, ents(), none), forYou(S, ents(), none));
  f(S, ents(), new Set());
  assert.equal(calls, 1, "identical key: cached");
  f(S, ents(), new Set([1]));
  assert.equal(calls, 2, "hidden changed");
  f([...S], ents(), new Set([1]));
  assert.equal(calls, 3, "new S");
});
