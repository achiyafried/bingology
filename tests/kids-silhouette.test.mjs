import test from "node:test";
import assert from "node:assert/strict";
import { pickTargets, tryFill, allFilled, blocksFreeDrop, MIN_GAP, FILL } from "../site/kids/silhouette.js";
import { sceneHTML } from "../site/kids/scene.js";

const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const it = (tmdb, o = {}) => ({ tmdb, name: `S${tmdb}`, age: "small", backdrop: B, cutout: true, ...o });
const items = [it(1), it(2), it(3), it(4), it(5, { cutout: undefined })];

test("pickTargets: up to 3 distinct cut-out characters, spread apart inside the scene", () => {
  for (let k = 0; k < 30; k++) {
    const t = pickTargets(items, seeded());
    assert.equal(t.length, 3);
    assert.equal(new Set(t.map(x => x.tmdb)).size, 3);
    assert.ok(t.every(x => x.tmdb !== 5 && !x.done));
    for (const x of t) { assert.ok(x.x >= 0.15 && x.x <= 0.85); assert.ok(x.y >= 0.4 && x.y <= 0.75); }
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert.ok(Math.abs(t[a].x - t[b].x) >= MIN_GAP - 1e-9);
  }
  assert.equal(pickTargets([it(1), it(9, { cutout: undefined })], seeded()).length, 1);
  assert.deepEqual(pickTargets([it(9, { cutout: undefined })], seeded()), []);
});

test("tryFill: the right character close enough fills its silhouette", () => {
  const t = [{ tmdb: 1, x: 0.5, y: 0.5, done: false }, { tmdb: 2, x: 0.2, y: 0.5, done: false }];
  const hit = tryFill(t, 1, 0.5 + FILL - 0.01, 0.5);
  assert.notEqual(hit, t); assert.equal(hit[0].done, true);
  assert.equal(tryFill(t, 1, 0.5 + FILL + 0.01, 0.5), t);
  assert.equal(tryFill(t, 2, 0.5, 0.5), t); // wrong character on this silhouette
  // the zone is a circle in pixels on the 16:9 scene: vertically it reaches FILL x 16/9 in height fractions
  assert.equal(tryFill(t, 1, 0.5, 0.5 + FILL * 16 / 9 - 0.01)[0].done, true);
  assert.equal(tryFill(t, 1, 0.5, 0.5 + FILL * 16 / 9 + 0.01), t);
  assert.equal(allFilled(t), false);
  assert.equal(allFilled(t.map(x => ({ ...x, done: true }))), true);
  assert.equal(allFilled([]), false);
});

test("sceneHTML: silhouettes dark until filled, colour when done", () => {
  const h = sceneHTML("kitchen", [], items, { targets: [{ tmdb: 1, x: 0.3, y: 0.5, done: false }, { tmdb: 2, x: 0.7, y: 0.5, done: true }] });
  assert.match(h, /class="k-sil" style="left:30%;top:50%"[^>]*><img src="kids\/chars\/1\.png"/);
  assert.match(h, /class="k-sil k-sil-done" style="left:70%;top:50%"/);
});

test("blocksFreeDrop: while silhouettes wait to be filled, a wrong drop doesn't stay", () => {
  const t = [{ tmdb: 1, x: 0.5, y: 0.5, done: false }, { tmdb: 2, x: 0.2, y: 0.5, done: true }];
  assert.equal(blocksFreeDrop(t), true);
  assert.equal(blocksFreeDrop(t.map(x => ({ ...x, done: true }))), false);
  assert.equal(blocksFreeDrop([]), false);
});
