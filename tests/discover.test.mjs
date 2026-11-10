import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverParams, rankPool, autoTags, poolEntry, EXCLUDED_GENRES } from "../scripts/lib/discover.mjs";

test("discover asks for well-rated shows and leaves out reality, talk, news, kids and animation", () => {
  const p = discoverParams(3);
  assert.equal(p.page, 3);
  assert.equal(p["vote_average.gte"], 7.5);
  assert.equal(p["vote_count.gte"], 500);
  assert.deepEqual(EXCLUDED_GENRES, [16, 10762, 10763, 10764, 10767]);
  assert.equal(p.without_genres, "16|10762|10763|10764|10767");
});

test("rankPool dedupes, skips curated ids and excluded genres, ranks by a vote-weighted score", () => {
  const r = (id, va, vc, genre_ids = [18]) => ({ id, vote_average: va, vote_count: vc, genre_ids });
  const results = [r(1, 9.0, 600), r(2, 8.6, 20000), r(3, 8.8, 5000), r(2, 8.6, 20000), r(4, 9.9, 800, [16]), r(5, 8.0, 3000)];
  // Bayesian: (v·n + C·1000)/(n + 1000), C = mean rating → 3: 8.77, 1: 8.75, 2: 8.60, 5: 8.15
  assert.deepEqual(rankPool(results, new Set([3]), 2), [1, 2]);
  assert.deepEqual(rankPool(results, new Set(), 10), [3, 1, 2, 5]);
});

test("autoTags maps TMDB genres to our genres, moods and weight", () => {
  const g = (...ids) => ids.map(id => ({ id }));
  assert.deepEqual(autoTags({ genres: g(35), origin_country: ["US"] }, 14), { genres: ["comedy"], moods: ["laugh"], weight: 1 });
  assert.deepEqual(autoTags({ genres: g(80, 18), origin_country: ["US"] }, 17), { genres: ["crime", "drama"], moods: ["tense", "feel"], weight: 3 });
  assert.deepEqual(autoTags({ genres: g(10765, 9648), origin_country: ["GB"] }, 14), { genres: ["scifi", "fantasy", "mystery"], moods: ["think", "escape", "tense"], weight: 2 });
  assert.deepEqual(autoTags({ genres: g(18), origin_country: ["IL"] }, 14).genres, ["drama", "israeli"]);
  assert.deepEqual(autoTags({ genres: [], origin_country: [] }, null), { genres: ["drama"], moods: ["feel"], weight: 2 });
});

test("poolEntry builds a curated-shaped entry marked as pool", () => {
  const e = poolEntry({ id: 42, name: "Show", genres: [{ id: 35 }], origin_country: ["US"] }, 14);
  assert.deepEqual(e, { tmdbId: 42, name: "Show", lists: ["pool"], genres: ["comedy"], moods: ["laugh"], weight: 1, solo: false, blurb: "", rt: null, fallback: {} });
});
