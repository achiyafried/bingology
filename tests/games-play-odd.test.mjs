import { test } from "node:test";
import assert from "node:assert/strict";
import { init, play, round, result } from "../site/lib/games/odd.js";

const r = odd => ({ actor: { name: "a", photo: "p" }, series: [0, 1, 2, 3].map(id => ({ id, name: `s${id}`, poster: "" })), odd });
const puzzle = { rounds: [r(1), r(2), r(3)] };
const run = (idx, s = init(puzzle)) => idx.reduce((st, index) => play(st, puzzle, { index }), s);

test("2 of 3 correct", () => {
  const s = run([1, 0, 3]);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 2, label: "2/3" });
});

test("round advances and a move after done is ignored", () => {
  const s0 = init(puzzle);
  assert.equal(round(s0), 0);
  const s1 = play(s0, puzzle, { index: 1 });
  assert.equal(round(s1), 1);
  assert.deepEqual(s0.picks, []);
  const done = run([0, 0, 0]);
  assert.equal(round(done), 2);
  assert.equal(play(done, puzzle, { index: 3 }), done);
  assert.equal(result(done, puzzle).label, "0/3");
  assert.equal(result(done, puzzle).win, false);
});

test("out-of-range index is ignored", () => {
  const s = init(puzzle);
  assert.equal(play(s, puzzle, { index: 4 }), s);
});
