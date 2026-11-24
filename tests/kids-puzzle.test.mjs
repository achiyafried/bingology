import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, levelFor, initPuzzle, trySnap, solved, pickerHTML, puzzleHTML, levelsHTML, puzzleScreen } from "../site/kids/puzzle.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const item = { tmdb: 7, name: "x", backdrop: B, poster: "https://image.tmdb.org/t/p/w342/p.jpg", age: "small" };
const seeded = () => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test("levels: six sizes from 4 to 20 with their grids", () => {
  assert.deepEqual(LEVELS.map(l => [l.n, l.cols, l.rows]), [[4, 2, 2], [6, 3, 2], [9, 3, 3], [12, 4, 3], [16, 4, 4], [20, 5, 4]]);
  for (const l of LEVELS) assert.equal(levelFor(l.n), l);
  for (const bad of [0, 7, 21, NaN, "9"]) assert.equal(levelFor(bad), null);
});

test("initPuzzle: all unplaced, tray is a non-identity permutation", () => {
  for (const n of [4, 6, 9, 20]) {
    for (let k = 0; k < 20; k++) {
      const s = initPuzzle(7, n, seeded());
      assert.equal(s.n, n);
      assert.equal(s.cols * s.rows, n);
      assert.equal(s.tmdb, 7);
      assert.equal(s.placed.length, n);
      assert.ok(s.placed.every(p => p === false));
      assert.deepEqual([...s.tray].sort((a, b) => a - b), [...Array(n).keys()]);
      assert.notDeepEqual(s.tray, [...Array(n).keys()]);
    }
  }
  const big = initPuzzle(1, 20, seeded());
  assert.deepEqual([big.cols, big.rows], [5, 4]);
  assert.notDeepEqual(initPuzzle(7, 4, () => 0).tray, [0, 1, 2, 3]);
});

test("trySnap: within 35% of the cell centre snaps, beyond does not", () => {
  const s = initPuzzle(7, 4, seeded());
  const board = { w: 400, h: 225 }; // cells 200 x 112.5
  const near = trySnap(s, 1, 300 + 0.34 * 200, 56.25, board);
  assert.equal(near.placed[1], true);
  const far = trySnap(s, 1, 300 + 0.36 * 200, 56.25, board);
  assert.equal(far.placed[1], false);
  assert.equal(far, s);
  assert.equal(s.placed[1], false);
});

test("trySnap: a piece dropped on another piece's cell stays unplaced", () => {
  const s = initPuzzle(7, 4, seeded());
  const board = { w: 400, h: 225 };
  assert.equal(trySnap(s, 0, 300, 56.25, board).placed[0], false);
});

test("solved only when every piece is placed", () => {
  const s = initPuzzle(7, 4, seeded());
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
  const s = initPuzzle(7, 4, seeded());
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

test("levelsHTML: six level buttons with Hebrew labels, the current one pressed", () => {
  const h = levelsHTML(item, 9);
  const btns = h.match(/data-a="go" data-v="puzzle\/7\/(\d+)"/g) || [];
  assert.equal(btns.length, 6);
  for (const n of [4, 6, 9, 12, 16, 20]) assert.match(h, new RegExp(`aria-label="פאזל של ${n} חלקים"`));
  assert.match(h, /data-v="puzzle\/7\/9"[^>]*aria-pressed="true"/);
  assert.equal((h.match(/aria-pressed="true"/g) || []).length, 1);
});

test("puzzleScreen: picker, levels or board from the route", () => {
  const items = [item];
  assert.equal(puzzleScreen({ game: "puzzle", arg: null, sub: null }, items), "picker");
  assert.equal(puzzleScreen({ game: "puzzle", arg: "999", sub: null }, items), "picker");
  assert.equal(puzzleScreen({ game: "puzzle", arg: "7", sub: null }, items), "levels");
  assert.equal(puzzleScreen({ game: "puzzle", arg: "7", sub: "7" }, items), "levels");
  assert.equal(puzzleScreen({ game: "puzzle", arg: "7", sub: "x" }, items), "levels");
  assert.equal(puzzleScreen({ game: "puzzle", arg: "7", sub: "9" }, items), "board");
});
