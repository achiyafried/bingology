import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreSeries, poolIds } from "../site/lib/score.js";
import { fromData } from "../site/lib/data.js";

const S = fromData(JSON.parse(readFileSync("tests/fixtures/data-small.json", "utf8")));
const byName = n => S.find(s => s.n === n);

test("scores match the legacy formula", () => {
  const a = { genres: ["crime"], mood: "tense", platforms: [] };
  assert.equal(scoreSeries(byName("Breaking Bad"), a).pct, 100);
  assert.equal(scoreSeries(byName("Severance"), a).pct, 32);
  assert.equal(scoreSeries(byName("Ted Lasso"), { genres: [], platforms: [], weight: 3 }).pct, 0);
});

test("pool filters by list and by any matching provider", () => {
  assert.deepEqual(poolIds(S, "any", ["netflix"]).map(i => S[i].n), ["Breaking Bad"]);
  assert.deepEqual(poolIds(S, "any", ["apple", "netflix"]).length, 3);
  assert.deepEqual(poolIds(S, "nyt", []).map(i => S[i].n), ["Breaking Bad", "Severance"]);
  assert.deepEqual(poolIds(S, "mine", []).length, 3);
});

test("quality: at or above the threshold counts fully, far below counts nothing", () => {
  const ted = byName("Ted Lasso");
  assert.equal(scoreSeries({ ...ted, bs: 80 }, { genres: [], platforms: [], quality: 75 }).pct, 100);
  assert.equal(scoreSeries({ ...ted, bs: 72 }, { genres: [], platforms: [], quality: 75 }).pct, 40);
  assert.equal(scoreSeries({ ...ted, bs: 60 }, { genres: [], platforms: [], quality: 75 }).pct, 0);
});

test("a series without a binge score is scored, not crashed", () => {
  const r = scoreSeries({ ...byName("Ted Lasso"), bs: null }, { genres: [], platforms: [], quality: 75 });
  assert.equal(r.pct, 0);
  assert.ok(r.items.some(x => !x.ok && x.t.includes("ציון")));
});
