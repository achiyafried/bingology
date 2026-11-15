import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreSeries, poolIds, eraOf, popularity } from "../site/lib/score.js";
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

const only = company => ({ genres: [], platforms: [], company });

test("company: alone favors 'better alone' series but accepts all", () => {
  assert.equal(scoreSeries({ ...byName("Ted Lasso"), solo: true }, only("solo")).pct, 100);
  assert.equal(scoreSeries({ ...byName("Ted Lasso"), solo: false }, only("solo")).pct, 80);
});

test("company: as a couple, 'better alone' series do not fit", () => {
  assert.equal(scoreSeries({ ...byName("Ted Lasso"), solo: true }, only("couple")).pct, 0);
  assert.equal(scoreSeries({ ...byName("Ted Lasso"), solo: false }, only("couple")).pct, 100);
});

test("company: family uses the age rating, then weight when unknown", () => {
  const ted = { ...byName("Ted Lasso"), solo: false };
  assert.equal(scoreSeries({ ...ted, minAge: 14 }, only("family")).pct, 100);
  assert.equal(scoreSeries({ ...ted, minAge: 17 }, only("family")).pct, 0);
  assert.equal(scoreSeries({ ...ted, minAge: 16 }, only("family")).pct, 40);
  assert.equal(scoreSeries({ ...ted, minAge: null, h: 1 }, only("family")).pct, 67);
  assert.equal(scoreSeries({ ...ted, minAge: null, h: 3 }, only("family")).pct, 0);
  assert.equal(scoreSeries({ ...ted, minAge: 10, solo: true }, only("family")).pct, 0);
  const why = scoreSeries({ ...ted, minAge: 17 }, only("family")).items[0];
  assert.equal(why.ok, false);
  assert.match(why.t, /17/);
});

test("eraOf buckets premiere years into decades (80s and earlier together)", () => {
  assert.equal(eraOf(1975), "80");
  assert.equal(eraOf(1989), "80");
  assert.equal(eraOf(1993), "90");
  assert.equal(eraOf(2008), "00");
  assert.equal(eraOf(2019), "10");
  assert.equal(eraOf(2025), "20");
  assert.equal(eraOf(null), null);
});

test("eras: chosen decade fits fully, a neighbouring decade half, others not", () => {
  const s = { ...byName("Breaking Bad") }; // 2008 → "00"
  assert.equal(scoreSeries(s, { genres: [], platforms: [], eras: ["00"] }).pct, 100);
  assert.equal(scoreSeries(s, { genres: [], platforms: [], eras: ["10"] }).pct, 50);
  assert.equal(scoreSeries(s, { genres: [], platforms: [], eras: ["20"] }).pct, 0);
  assert.equal(scoreSeries(s, { genres: [], platforms: [], eras: ["20", "00"] }).pct, 100);
  assert.equal(scoreSeries({ ...s, y: null }, { genres: [], platforms: [], eras: ["00"] }).pct, 0);
});

test("pool source picks only wide-pool series; any includes everything", () => {
  const SP = S.concat([{ ...S[2], tmdbId: 9, n: "Pool Show", lists: ["pool"], nyt: null }]);
  assert.deepEqual(poolIds(SP, "pool", []).map(i => SP[i].n), ["Pool Show"]);
  assert.equal(poolIds(SP, "any", []).length, 4);
  assert.ok(!poolIds(SP, "mine", []).some(i => SP[i].n === "Pool Show"));
});

test("avoid: a series in a genre to avoid loses that item; one outside it keeps it", () => {
  const s = { ...byName("Breaking Bad"), g: ["crime", "drama"] };
  const bad = scoreSeries(s, { genres: [], avoid: ["crime"], platforms: [] });
  assert.equal(bad.pct, 0);
  assert.match(bad.items[0].t, /להימנע/);
  const ok = scoreSeries(s, { genres: [], avoid: ["comedy"], platforms: [] });
  assert.equal(ok.pct, 100);
});

test("status: ended fits 'done', airing fits 'airing', canceled is half a fit for 'done'", () => {
  const base = byName("Breaking Bad"), a = st => ({ genres: [], status: st, platforms: [] });
  assert.equal(scoreSeries({ ...base, status: "ended" }, a("done")).pct, 100);
  assert.equal(scoreSeries({ ...base, status: "airing" }, a("done")).pct, 0);
  assert.equal(scoreSeries({ ...base, status: "airing" }, a("airing")).pct, 100);
  assert.equal(scoreSeries({ ...base, status: "canceled" }, a("done")).pct, 50);
});

test("popularity: percentile of TMDB votes in the list; no votes counts as least known", () => {
  const p = popularity([{ tmdbVotes: 10 }, { tmdbVotes: 1000 }, { tmdbVotes: null }, { tmdbVotes: 100 }]);
  assert.deepEqual(p, [1 / 3, 1, 0, 2 / 3]);
});

test("fame: hits fit 'hit', little-known series fit 'gem', the middle is half a fit", () => {
  const base = byName("Breaking Bad"), a = f => ({ genres: [], fame: f, platforms: [] });
  assert.equal(scoreSeries({ ...base, pop: 0.9 }, a("hit")).pct, 100);
  assert.equal(scoreSeries({ ...base, pop: 0.6 }, a("hit")).pct, 50);
  assert.equal(scoreSeries({ ...base, pop: 0.1 }, a("hit")).pct, 0);
  assert.equal(scoreSeries({ ...base, pop: 0.1 }, a("gem")).pct, 100);
  assert.equal(scoreSeries({ ...base, pop: 0.9 }, a("gem")).pct, 0);
});

test("mature: 'mild' fits age 14 and under, 'intense' fits 17+, unknown age is half a fit", () => {
  const base = byName("Breaking Bad"), a = m => ({ genres: [], mature: m, platforms: [] });
  assert.equal(scoreSeries({ ...base, minAge: 12 }, a("mild")).pct, 100);
  assert.equal(scoreSeries({ ...base, minAge: 17 }, a("mild")).pct, 0);
  assert.equal(scoreSeries({ ...base, minAge: 18 }, a("intense")).pct, 100);
  assert.equal(scoreSeries({ ...base, minAge: 10 }, a("intense")).pct, 0);
  assert.equal(scoreSeries({ ...base, minAge: null }, a("mild")).pct, 50);
});
