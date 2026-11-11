import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPartner, jointPick } from "../site/lib/jointpick.js";

const S = [{ tmdbId: 95396 }, { tmdbId: 136315 }, { tmdbId: 1 }, { tmdbId: 2 }];
const scores = [{ score: 80 }, { score: 90 }, { score: 70 }, { score: null }];
const L = (o) => new Map(Object.entries(o).map(([u, rows]) => [u, new Map(rows)]));

test("shared: both want, highest score wins", () => {
  const lists = L({ a: [[95396, "want"], [136315, "want"]], b: [[95396, "want"], [136315, "want"]] });
  assert.deepEqual(jointPick(S, scores, lists, ["a", "b"], new Set()), { tmdbId: 136315, mode: "shared" });
});

test("shared: another circle member having seen it is still allowed", () => {
  const lists = L({ a: [[95396, "want"]], b: [[95396, "want"]], c: [[95396, "seen"]] });
  assert.deepEqual(jointPick(S, scores, lists, ["a", "b"], new Set()), { tmdbId: 95396, mode: "shared" });
});

test("shared: not want for both members is excluded", () => {
  const lists = L({ a: [[95396, "want"], [136315, "want"]], b: [[95396, "want"], [136315, "seen"]] });
  assert.equal(jointPick(S, scores, lists, ["a", "b"], new Set()).tmdbId, 95396);
});

test("skipped moves to the next best", () => {
  const lists = L({ a: [[95396, "want"], [136315, "want"]], b: [[95396, "want"], [136315, "want"]] });
  assert.equal(jointPick(S, scores, lists, ["a", "b"], new Set([136315])).tmdbId, 95396);
});

test("fallback: best series nobody in the circle has seen/watching/dropped", () => {
  const lists = L({ a: [[136315, "seen"]], b: [[95396, "want"]], c: [[1, "dropped"]] });
  assert.deepEqual(jointPick(S, scores, lists, ["a", "b"], new Set()), { tmdbId: 95396, mode: "fallback" });
});

test("fallback: another circle member's seen excludes it", () => {
  const lists = L({ a: [], b: [], c: [[136315, "seen"], [95396, "watching"]] });
  assert.deepEqual(jointPick(S, scores, lists, ["a", "b"], new Set()), { tmdbId: 1, mode: "fallback" });
});

test("null scores rank below scored series", () => {
  const lists = L({ a: [], b: [], c: [[136315, "seen"], [95396, "seen"], [1, "seen"]] });
  assert.deepEqual(jointPick(S, scores, lists, ["a", "b"], new Set()), { tmdbId: 2, mode: "fallback" });
  assert.equal(jointPick(S, scores, lists, ["a", "b"], new Set([2])), null);
});

test("everything excluded gives null", () => {
  const lists = L({ a: [], b: [] });
  assert.equal(jointPick(S, scores, lists, ["a", "b"], new Set(S.map(s => s.tmdbId))), null);
});

test("pickPartner picks most shared wants; alone gives null", () => {
  const lists = L({
    me: [[1, "want"], [2, "want"], [3, "want"]],
    x: [[1, "want"]],
    y: [[1, "want"], [2, "want"], [3, "seen"]],
  });
  assert.equal(pickPartner("me", lists), "y");
  assert.equal(pickPartner("me", L({ me: [[1, "want"]] })), null);
});

test("pickPartner tie goes to first in map order", () => {
  const lists = L({ me: [[1, "want"]], x: [[1, "want"]], y: [[1, "want"]] });
  assert.equal(pickPartner("me", lists), "x");
});
