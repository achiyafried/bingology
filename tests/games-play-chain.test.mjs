import { test } from "node:test";
import assert from "node:assert/strict";
import { init, play, result } from "../site/lib/games/chain.js";

const puzzle = { from: 1, to: 3, shortest: 2, limit: 4, series: {
  1: { name: "A", poster: "", cast: ["x", "y"] },
  2: { name: "B", poster: "", cast: ["x", "z"] },
  3: { name: "C", poster: "", cast: ["z", "w"] },
  4: { name: "D", poster: "", cast: ["y", "q"] },
  5: { name: "E", poster: "", cast: ["q"] },
} };
const step = (s, actor, to) => play(s, puzzle, { type: "step", actor, to });

test("perfect path", () => {
  let s = step(init(puzzle), "x", 2);
  s = step(s, "z", 3);
  assert.equal(s.done, true);
  assert.deepEqual(s.via, ["x", "z"]);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 2, label: "מושלם" });
});

test("back then forward counts both steps; success label", () => {
  let s = step(init(puzzle), "y", 4);
  s = play(s, puzzle, { type: "back" });
  assert.deepEqual(s.path, [1]);
  assert.equal(s.steps, 1);
  s = step(s, "x", 2);
  s = step(s, "z", 3);
  assert.equal(s.steps, 3);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 3, label: "הצלחה" });
});

test("limit reached without arriving", () => {
  let s = init(puzzle);
  s = step(s, "y", 4); s = step(s, "y", 1); s = step(s, "y", 4); s = step(s, "q", 5);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: false, score: 4, label: "נתקעת" });
  assert.equal(step(s, "q", 4), s);
});

test("invalid moves are ignored; string ids accepted", () => {
  const s0 = init(puzzle);
  assert.equal(step(s0, "z", 2), s0);      // actor not in current series
  assert.equal(step(s0, "x", 5), s0);      // actor not in target cast
  assert.equal(step(s0, "x", 99), s0);     // unknown series
  assert.equal(play(s0, puzzle, { type: "back" }), s0);
  assert.equal(step(s0, "x", "2").steps, 1);
});

test("hint: sets hinted, keeps the rest; a shortest win is then only success", () => {
  const s0 = init(puzzle);
  assert.equal(s0.hinted, undefined);
  const h = play(s0, puzzle, { type: "hint" });
  assert.deepEqual(h, { ...s0, hinted: true });
  assert.equal(play(h, puzzle, { type: "hint" }), h);
  let s = step(h, "x", 2);
  assert.equal(s.hinted, true);
  s = step(s, "z", 3);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 2, label: "הצלחה" });
  assert.equal(play(s, puzzle, { type: "hint" }), s);
  assert.equal(s0.hinted, undefined, "pure");
});

test("hint after a back keeps hinted", () => {
  let s = play(step(init(puzzle), "x", 2), puzzle, { type: "hint" });
  s = play(s, puzzle, { type: "back" });
  assert.equal(s.hinted, true);
});
