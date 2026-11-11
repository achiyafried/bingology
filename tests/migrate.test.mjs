import { test } from "node:test";
import assert from "node:assert/strict";
import { seenToEntries, MIGRATED_KEY } from "../site/lib/migrate.js";

const S = [
  { tmdbId: 1396, n: "Breaking Bad", poster: "/bb.jpg" },
  { tmdbId: 1438, n: "The Wire", poster: "/wire.jpg" },
];
const store = (obj) => ({ getItem: (k) => (k in obj ? obj[k] : null), setItem() {} });

test("MIGRATED_KEY", () => assert.equal(MIGRATED_KEY, "bingology:migrated"));

test("v2 marks become rows with title and poster", () => {
  const st = store({ "tvpick:v2": JSON.stringify({ seen: [1396, 1438] }) });
  assert.deepEqual(seenToEntries(st, S, new Set()), [
    { tmdb_id: 1396, status: "seen", title: "Breaking Bad", poster: "/bb.jpg" },
    { tmdb_id: 1438, status: "seen", title: "The Wire", poster: "/wire.jpg" },
  ]);
});

test("v1 position marks map through S", () => {
  const st = store({ "tvpick:v1": JSON.stringify({ seen: [0, 1] }) });
  assert.deepEqual(seenToEntries(st, S, new Set()).map(r => r.tmdb_id), [1396, 1438]);
});

test("ids already in the account are skipped", () => {
  const st = store({ "tvpick:v2": JSON.stringify({ seen: [1396, 1438] }) });
  assert.deepEqual(seenToEntries(st, S, new Set([1396])).map(r => r.tmdb_id), [1438]);
});

test("ids missing from today's data are skipped", () => {
  const st = store({ "tvpick:v2": JSON.stringify({ seen: [1396, 999] }) });
  assert.deepEqual(seenToEntries(st, S, new Set()).map(r => r.tmdb_id), [1396]);
});

test("throwing storage gives []", () => {
  const st = { getItem() { throw new Error("denied"); } };
  assert.deepEqual(seenToEntries(st, S, new Set()), []);
});
