import { test } from "node:test";
import assert from "node:assert/strict";
import { init, play, blurPx, hints, result } from "../site/lib/games/blur.js";

const puzzle = { actor: { name: "Bryan Cranston", photo: "p" }, count: 12, series: ["Argo", "Better Call Saul", "Breaking Bad"] };
const miss = (s, n = 1) => { for (let i = 0; i < n; i++) s = play(s, puzzle, { name: `wrong${s.guesses.length}` }); return s; };

test("name match is trimmed and case-insensitive", () => {
  const s = play(init(puzzle), puzzle, { name: "  bryan CRANSTON " });
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 1, label: "1/5" });
});

test("blur px sequence", () => {
  const px = [];
  let s = init(puzzle);
  for (let i = 0; i < 5; i++) { px.push(blurPx(s)); s = miss(s); }
  assert.deepEqual(px, [24, 16, 10, 5, 2]);
  assert.equal(blurPx(s), 0);
  assert.equal(blurPx(play(init(puzzle), puzzle, { name: "Bryan Cranston" })), 0);
});

test("hint sequence", () => {
  assert.deepEqual(hints(init(puzzle), puzzle), []);
  assert.deepEqual(hints(miss(init(puzzle)), puzzle), ["12 סדרות במאגר"]);
  assert.deepEqual(hints(miss(init(puzzle), 3), puzzle), ["12 סדרות במאגר", "Argo", "Better Call Saul"]);
});

test("fifth miss fails with X/5; later moves ignored; blank ignored", () => {
  const s = miss(init(puzzle), 5);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: false, score: null, label: "X/5" });
  assert.equal(play(s, puzzle, { name: "Bryan Cranston" }), s);
  const s0 = init(puzzle);
  assert.equal(play(s0, puzzle, { name: "   " }), s0);
});
