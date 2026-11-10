import { test } from "node:test";
import assert from "node:assert/strict";
import { bingeScores } from "../site/lib/binge.js";

const base = { imdb: null, rt: null, nyt: null, tmdbVote: null, tmdbVotes: null };
const mk = o => ({ ...base, ...o });

test("one source: percentile within the list mapped to 50–100", () => {
  const r = bingeScores([mk({ imdb: 9 }), mk({ imdb: 8 }), mk({ imdb: 7 })]);
  assert.deepEqual(r.map(x => x.score), [100, 75, 50]);
  assert.deepEqual(r[1].parts, { imdb: 0.5 });
});

test("missing sources do not count against a series (weights renormalize)", () => {
  const r = bingeScores([mk({ imdb: 9, rt: 80 }), mk({ imdb: 8, rt: 99 }), mk({ imdb: 7 })]);
  // A: imdb 1.0 (w .4), rt 0 (w .3) → .4/.7 = .571 → 79
  assert.equal(r[0].score, 79);
  // C: imdb only, bottom → 50
  assert.equal(r[2].score, 50);
});

test("a better NYT rank scores higher", () => {
  const r = bingeScores([mk({ imdb: 8, nyt: 1 }), mk({ imdb: 8, nyt: 50 })]);
  assert.ok(r[0].score > r[1].score);
});

test("few TMDB votes are pulled toward the average", () => {
  const r = bingeScores([mk({ tmdbVote: 9.8, tmdbVotes: 3 }), mk({ tmdbVote: 9.2, tmdbVotes: 10000 }), mk({ tmdbVote: 8.0, tmdbVotes: 5000 })]);
  assert.ok(r[1].score > r[0].score, JSON.stringify(r));
});

test("no sources at all → null score", () => {
  assert.equal(bingeScores([mk({}), mk({ imdb: 8 })])[0].score, null);
});
