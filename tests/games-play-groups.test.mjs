import { test } from "node:test";
import assert from "node:assert/strict";
import { init, play, result } from "../site/lib/games/groups.js";

const items = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, name: `s${i + 1}`, poster: "" }));
const groups = [0, 1, 2, 3].map(g => ({ kind: "year", key: g, label: `g${g}`, level: g + 1, ids: [1, 2, 3, 4].map(n => g * 4 + n) }));
const puzzle = { items, groups };
const go = (s, ids) => play(s, puzzle, { ids });

test("three of four is one-away and costs a mistake", () => {
  const s = go(init(puzzle), [1, 2, 3, 5]);
  assert.equal(s.last, "one-away");
  assert.equal(s.mistakes, 1);
  assert.equal(go(init(puzzle), [1, 5, 9, 13]).last, "wrong");
});

test("repeat wrong set costs nothing", () => {
  const s1 = go(init(puzzle), [1, 2, 3, 5]);
  const s2 = go(s1, [5, 3, 2, 1]);
  assert.equal(s2.last, "repeat");
  assert.equal(s2.mistakes, 1);
});

test("fourth mistake ends the game with X", () => {
  let s = init(puzzle);
  for (const ids of [[1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15], [4, 8, 12, 16]]) s = go(s, ids);
  assert.equal(s.done, true);
  assert.deepEqual(result(s, puzzle), { done: true, win: false, score: 4, label: "X" });
  assert.equal(go(s, [1, 2, 3, 4]), s);
});

test("solving all with one mistake", () => {
  let s = go(init(puzzle), [1, 2, 3, 5]);
  assert.equal(s.solved.length, 0);
  for (const g of [2, 0, 1, 3]) s = go(s, groups[g].ids);
  assert.equal(s.last, "ok");
  assert.deepEqual(s.solved, [2, 0, 1, 3]);
  assert.deepEqual(result(s, puzzle), { done: true, win: true, score: 1, label: "1 טעות" });
});

test("zero and many mistakes labels", () => {
  let s = init(puzzle);
  for (const g of groups) s = go(s, g.ids);
  assert.equal(result(s, puzzle).label, "0 טעויות");
  let t = init(puzzle);
  for (const ids of [[1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]]) t = go(t, ids);
  for (const g of groups) t = go(t, g.ids);
  assert.equal(result(t, puzzle).label, "3 טעויות");
});

test("not exactly four distinct item ids leaves state unchanged", () => {
  const s = init(puzzle);
  assert.equal(go(s, [1, 2, 3]), s);
  assert.equal(go(s, [1, 2, 3, 3]), s);
  assert.equal(go(s, [1, 2, 3, 4, 5]), s);
  assert.equal(go(s, [1, 2, 3, 99]), s);
});
