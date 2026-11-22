import test from "node:test";
import assert from "node:assert/strict";
import { grid, initPuzzle, trySnap, solved, pickerHTML, puzzleHTML } from "../site/kids/puzzle.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const item = { tmdb: 7, name: "x", backdrop: B, poster: "https://image.tmdb.org/t/p/w342/p.jpg", age: "small" };
const seeded = () => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test("grid: 2x2 below level 3, 3x2 from 3", () => {
  assert.deepEqual(grid(0), { cols: 2, rows: 2 });
  assert.deepEqual(grid(2), { cols: 2, rows: 2 });
  assert.deepEqual(grid(3), { cols: 3, rows: 2 });
  assert.deepEqual(grid(9), { cols: 3, rows: 2 });
});

test("initPuzzle: all unplaced, tray is a non-identity permutation", () => {
  for (const level of [0, 3]) {
    for (let k = 0; k < 20; k++) {
      const s = initPuzzle(7, level, seeded());
      const n = s.cols * s.rows;
      assert.equal(s.tmdb, 7);
      assert.equal(s.placed.length, n);
      assert.ok(s.placed.every(p => p === false));
      assert.deepEqual([...s.tray].sort((a, b) => a - b), [...Array(n).keys()]);
      assert.notDeepEqual(s.tray, [...Array(n).keys()]);
    }
  }
  assert.notDeepEqual(initPuzzle(7, 0, () => 0).tray, [0, 1, 2, 3]);
});

test("trySnap: within 35% of the cell centre snaps, beyond does not", () => {
  const s = initPuzzle(7, 0, seeded());
  const board = { w: 400, h: 225 }; // cells 200 x 112.5
  const near = trySnap(s, 1, 300 + 0.34 * 200, 56.25, board);
  assert.equal(near.placed[1], true);
  const far = trySnap(s, 1, 300 + 0.36 * 200, 56.25, board);
  assert.equal(far.placed[1], false);
  assert.equal(far, s);
  assert.equal(s.placed[1], false);
});

test("trySnap: a piece dropped on another piece's cell stays unplaced", () => {
  const s = initPuzzle(7, 0, seeded());
  const board = { w: 400, h: 225 };
  assert.equal(trySnap(s, 0, 300, 56.25, board).placed[0], false);
});

test("solved only when every piece is placed", () => {
  const s = initPuzzle(7, 0, seeded());
  assert.equal(solved(s), false);
  assert.equal(solved({ ...s, placed: [true, true, true, false] }), false);
  assert.equal(solved({ ...s, placed: [true, true, true, true] }), true);
});

test("pickerHTML: posters that go to the puzzle", () => {
  const h = pickerHTML([item]);
  assert.match(h, /data-a="go" data-v="puzzle\/7"/);
  assert.match(h, /aria-label="/);
  assert.match(h, /src="https:\/\/image\.tmdb\.org/);
});

test("puzzleHTML: backdrop via safeImg; again only when solved", () => {
  const s = initPuzzle(7, 0, seeded());
  const h = puzzleHTML(item, s);
  assert.ok(h.includes(B));
  assert.ok(!h.includes('data-a="again"'));
  assert.equal((h.match(/data-piece=/g) || []).length, 4);
  const bad = puzzleHTML({ ...item, backdrop: "https://evil.com/a.jpg" }, s);
  assert.ok(!bad.includes("evil.com"));
  assert.ok(!bad.includes("url("));
  const done = puzzleHTML(item, { ...s, placed: [true, true, true, true], tray: [] });
  assert.ok(done.includes('data-a="again"'));
  assert.ok(!done.includes("data-piece="));
  assert.ok(done.includes("k-confetti"));
});
