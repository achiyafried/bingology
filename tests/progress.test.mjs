import { test } from "node:test";
import assert from "node:assert/strict";
import { nextEpisode, progress } from "../site/lib/progress.js";

const s = { e: 20, se: [10, 10] };

test("nextEpisode steps within and across seasons, stops at the final episode", () => {
  assert.deepEqual(nextEpisode({ season: 1, episode: 9 }, s), { season: 1, episode: 10, last: false });
  assert.deepEqual(nextEpisode({ season: 1, episode: 10 }, s), { season: 2, episode: 1, last: false });
  assert.deepEqual(nextEpisode({ season: 2, episode: 10 }, s), { season: 2, episode: 10, last: true });
});

test("progress counts episodes watched across seasons", () => {
  assert.deepEqual(progress({ season: 2, episode: 4 }, s), { watched: 14, total: 20, pct: 70, eveningsLeft: 3 });
});

test("without per-season data, the total is used", () => {
  const t = { e: 20, se: null };
  assert.deepEqual(nextEpisode({ season: 1, episode: 5 }, t), { season: 1, episode: 6, last: false });
  assert.equal(nextEpisode({ season: 1, episode: 20 }, t).last, true);
  assert.deepEqual(progress({ season: 1, episode: 5 }, t), { watched: 5, total: 20, pct: 25, eveningsLeft: 8 });
});

test("without any totals, no NaN", () => {
  const t = { e: null, se: null };
  assert.deepEqual(nextEpisode({ season: 1, episode: 5 }, t), { season: 1, episode: 6, last: false });
  assert.deepEqual(progress({ season: 1, episode: 5 }, t), { watched: 5, total: null, pct: null, eveningsLeft: null });
});

test("total is the sum of per-season counts when known, falling back to e", () => {
  assert.equal(progress({ season: 1, episode: 1 }, { e: 25, se: [10, 10] }).total, 20);
  assert.equal(progress({ season: 1, episode: 1 }, { e: 25, se: [] }).total, 25);
});

test("no per-season data and season > 1: estimate earlier seasons from the average, clamped to e", () => {
  const t = { s: 4, e: 40, se: null };
  assert.equal(progress({ season: 3, episode: 2 }, t).watched, 22);
  assert.equal(progress({ season: 4, episode: 30 }, t).watched, 40);
  assert.equal(progress({ season: 1, episode: 3 }, t).watched, 3);
});

test("+1 from no position goes to season 1 episode 1", () => {
  const from = { season: 1, episode: 0 };
  assert.deepEqual(nextEpisode(from, s), { season: 1, episode: 1, last: false });
  assert.deepEqual(nextEpisode(from, { e: 20, se: null }), { season: 1, episode: 1, last: false });
  assert.equal(progress(from, s).watched, 0);
});
