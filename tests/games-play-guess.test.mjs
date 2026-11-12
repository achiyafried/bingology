import { test } from "node:test";
import assert from "node:assert/strict";
import { init, play, revealed, result } from "../site/lib/games/guess.js";

const puzzle = { answer: { id: 1396, name: "Breaking Bad", poster: "p" }, clues: Array.from({ length: 6 }, (_, i) => ({ kind: "k", text: `c${i}` })) };
const run = (ids, s = init(puzzle)) => ids.reduce((st, id) => play(st, puzzle, { id }), s);

test("win on third guess", () => {
  const s = run([1, 2, 1396]);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 3, label: "3/6" });
});

test("six misses fail", () => {
  const s = run([1, 2, 3, 4, 5, 6]);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: false, score: null, label: "X/6" });
  assert.equal(revealed(s), 6);
});

test("repeated id counts once; moves after done are ignored; input not mutated", () => {
  const s0 = init(puzzle);
  const s1 = play(s0, puzzle, { id: 7 });
  assert.deepEqual(s0.guesses, []);
  assert.equal(play(s1, puzzle, { id: 7 }), s1);
  const done = run([1396]);
  assert.equal(play(done, puzzle, { id: 5 }), done);
});

test("same-name series with another id does not win", () => {
  const s = run([9999]);
  assert.equal(s.done, false);
  assert.equal(result(s, puzzle).win, false);
});

test("revealed clue count", () => {
  assert.equal(revealed(init(puzzle)), 1);
  assert.equal(revealed(run([1, 2])), 3);
  assert.equal(revealed(run([1, 2, 3, 4, 5])), 6);
  assert.equal(revealed(run([1396])), 6);
  assert.equal(result(init(puzzle), puzzle).done, false);
  JSON.stringify(init(puzzle));
});
