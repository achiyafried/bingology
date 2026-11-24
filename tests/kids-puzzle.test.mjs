import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, levelFor, initPuzzle, trySnap, solved, pickerHTML, puzzleHTML, levelsHTML, puzzleScreen, boardFor, onLevels, edges, pieceEdges, piecePath, pieceSVG } from "../site/kids/puzzle.js";

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

test("edges: one ±1 value per inner edge", () => {
  const e = edges(4, 3, seeded());
  assert.equal(e.h.length, 2); e.h.forEach(r => assert.equal(r.length, 4));
  assert.equal(e.v.length, 3); e.v.forEach(r => assert.equal(r.length, 3));
  for (const v of [...e.h.flat(), ...e.v.flat()]) assert.ok(v === 1 || v === -1);
  const st = initPuzzle(7, 12, seeded());
  assert.equal(st.edges.h.length, 2); assert.equal(st.edges.v[0].length, 3);
});

test("pieceEdges: frame sides are straight, inner sides curve", () => {
  const st = initPuzzle(7, 12, seeded());
  const e = pieceEdges(0, 0, st);
  assert.equal(e.top.length, 2); assert.equal(e.left.length, 2);
  assert.ok(e.right.length > 2); assert.ok(e.bottom.length > 2);
  const last = pieceEdges(3, 2, st);
  assert.equal(last.bottom.length, 2); assert.equal(last.right.length, 2);
});

test("pieceEdges: neighbours share each edge exactly (a tab meets a blank)", () => {
  const st = initPuzzle(7, 20, seeded());
  for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
    const a = pieceEdges(c, r, st);
    if (c + 1 < st.cols) assert.deepEqual(pieceEdges(c + 1, r, st).left, [...a.right].reverse());
    if (r + 1 < st.rows) assert.deepEqual(pieceEdges(c, r + 1, st).top, [...a.bottom].reverse());
  }
});

test("piecePath: a closed SVG path with curves on inner edges", () => {
  const st = initPuzzle(7, 4, seeded());
  const d = piecePath(0, 0, st);
  assert.match(d, /^M[\d.-]+ [\d.-]+/);
  assert.match(d, / C/);
  assert.match(d, /Z$/);
});

test("pieceSVG: clips the backdrop to the piece, unique ids, safe images only", () => {
  const st = initPuzzle(7, 6, seeded());
  const a = pieceSVG(0, st, B), b = pieceSVG(1, st, B);
  assert.match(a, /<clipPath id="pz-7-6-0">/);
  assert.match(a, /<image href="https:\/\/image\.tmdb\.org[^"]*" x="0" y="0" width="1600" height="900"[^>]*clip-path="url\(#pz-7-6-0\)"/);
  assert.notEqual(a.match(/id="([^"]+)"/)[1], b.match(/id="([^"]+)"/)[1]);
  assert.doesNotMatch(pieceSVG(0, st, "javascript:alert(1)"), /<image/);
});

test("puzzleHTML: tray pieces and placed pieces are SVG jigsaw shapes", () => {
  const st = initPuzzle(7, 9, seeded());
  const h = puzzleHTML(item, { ...st, placed: st.placed.map((_, i) => i === 0) });
  assert.equal((h.match(/class="k-pz-piece"/g) || []).length, 8);
  assert.match(h, /class="k-pz-placed"[^>]*viewBox="0 0 1600 900"/);
  assert.match(h, /clip-path="url\(#pz-7-9-0\)"/);
});

test("boardFor: keeps the current game (also on its win screen), new for another series/size", () => {
  const cur = initPuzzle(7, 9, seeded());
  assert.equal(boardFor(cur, 7, 9), cur);
  const won = { ...cur, placed: cur.placed.map(() => true), won: true };
  assert.equal(boardFor(won, 7, 9), won);
  assert.equal(boardFor(cur, 7, 12).n, 12);
  assert.equal(boardFor(cur, 8, 9).tmdb, 8);
  assert.equal(boardFor(null, 7, 4).n, 4);
});

test("onLevels: a solved game is dropped when the child is back on the level screen, a half-done one stays", () => {
  const cur = initPuzzle(7, 9, seeded());
  assert.equal(onLevels(cur), cur);
  assert.equal(onLevels({ ...cur, placed: cur.placed.map(() => true) }), null);
  assert.equal(onLevels(null), null);
  const won = { ...cur, placed: cur.placed.map(() => true) };
  assert.ok(boardFor(onLevels(won), 7, 9).placed.every(p => p === false));
});
