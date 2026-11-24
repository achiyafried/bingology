import test from "node:test";
import assert from "node:assert/strict";
import { addSticker, moveSticker, removeSticker, outside, placesHTML, sceneHTML, circleStyle } from "../site/kids/scene.js";
import { SCENES } from "../site/kids/scenes.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const it = (tmdb, o = {}) => ({ tmdb, name: `S${tmdb}`, age: "small", backdrop: B, ...o });

test("addSticker clamps to [0,1] and allows duplicates", () => {
  const a = addSticker([], 5, 1.2, -0.1);
  assert.deepEqual(a, [{ tmdb: 5, x: 1, y: 0 }]);
  assert.equal(addSticker(a, 5, 0.5, 0.5).length, 2);
  assert.deepEqual(a, [{ tmdb: 5, x: 1, y: 0 }]);
});

test("moveSticker and removeSticker by index; out of range is a no-op", () => {
  const l = [{ tmdb: 1, x: 0.1, y: 0.1 }, { tmdb: 2, x: 0.2, y: 0.2 }];
  assert.deepEqual(moveSticker(l, 1, 2, 0.5)[1], { tmdb: 2, x: 1, y: 0.5 });
  assert.equal(moveSticker(l, 2, 0.5, 0.5), l);
  assert.equal(moveSticker(l, -1, 0.5, 0.5), l);
  assert.deepEqual(removeSticker(l, 0), [l[1]]);
  assert.equal(removeSticker(l, 5), l);
  assert.equal(l.length, 2);
});

test("outside", () => {
  assert.equal(outside(1.01, 0.5), true);
  assert.equal(outside(0.5, -0.01), true);
  assert.equal(outside(1, 1), false);
  assert.equal(outside(0, 0), false);
});

test("SCENES: five places, safe SVGs", () => {
  assert.deepEqual(SCENES.map(s => s.id), ["kitchen", "garden", "beach", "bedroom", "park"]);
  assert.deepEqual(SCENES.map(s => s.label), ["מטבח", "גינה", "חוף", "חדר שינה", "פארק"]);
  for (const s of SCENES) {
    assert.match(s.svg, /viewBox="0 0 1600 900"/);
    assert.doesNotMatch(s.svg, /<text|<script|href|url\(http/i);
    assert.ok(s.svg.length < 3200, `${s.id} is ${s.svg.length} bytes`);
  }
});

test("placesHTML: five tiles", () => {
  const h = placesHTML();
  assert.equal(h.match(/data-a="go" data-v="scene\/\w+"/g).length, 5);
  assert.match(h, /aria-label="מטבח"/);
  assert.match(h, /<svg/);
});

test("sceneHTML: one element per saved sticker, tray only from withArt items", () => {
  const items = [it(1), it(2), it(3, { age: "mid" }), it(4, { backdrop: null })];
  const list = [{ tmdb: 1, x: 0.25, y: 0.5 }, { tmdb: 1, x: 0.8, y: 0.1 }, { tmdb: 2, x: 0.5, y: 0.5 }];
  const h = sceneHTML("beach", list, items);
  assert.equal(h.match(/data-i="\d+"/g).length, 3);
  assert.match(h, /left:25%;top:50%/);
  assert.equal(h.match(/data-t="\d+"/g).length, 2);
  assert.match(h, /data-t="1"/);
  assert.doesNotMatch(h, /data-t="3"|data-t="4"/);
  assert.match(h, /data-a="clear"/);
  assert.doesNotMatch(h, /clear-yes/);
  assert.match(h, /<svg/);
});

test("sceneHTML: unknown tmdb skipped, confirm state, unknown place", () => {
  const h = sceneHTML("park", [{ tmdb: 99, x: 0.5, y: 0.5 }], [it(1)], { confirm: true });
  assert.doesNotMatch(h, /data-i=/);
  assert.match(h, /data-a="clear-yes" aria-label="[^"]+"/);
  assert.match(h, /data-a="clear-no" aria-label="[^"]+"/);
  assert.match(h, /לנקות\?/);
  assert.equal(sceneHTML("nope", [], [it(1)]), placesHTML());
});

test("sceneHTML: a cut-out character instead of the circle when the series has one", () => {
  const items = [it(5, { cutout: true }), it(6)];
  const h = sceneHTML("kitchen", [{ tmdb: 5, x: 0.2, y: 0.3 }, { tmdb: 6, x: 0.5, y: 0.5 }], items);
  assert.equal((h.match(/<img class="k-cut-img" src="kids\/chars\/5\.png" alt="" draggable="false" data-tmdb="5">/g) || []).length, 2); // placed + tray
  assert.doesNotMatch(h, /chars\/6\.png/);
  assert.match(h, /class="k-sc-st k-cut" data-i="0"/);
  assert.match(h, /class="k-sc-tpl k-cut" data-t="5"/);
  assert.match(h, /class="k-sc-st" data-i="1"[^>]*background-image:url\(https:\/\/image\.tmdb\.org/);
});

test("sceneHTML: the cut-out path uses an integer id only", () => {
  const h = sceneHTML("kitchen", [], [it("5x", { cutout: true })]);
  assert.doesNotMatch(h, /chars\/5x/);
});

test("circleStyle: the round sticker style used when a cut-out fails to load", () => {
  assert.match(circleStyle(it(6)), /^background-image:url\(https:\/\/image\.tmdb\.org[^)]*\);background-size:/);
});

test("sceneHTML: arrows at both ends of the tray to scroll the characters", () => {
  const h = sceneHTML("kitchen", [], [it(5), it(6)]);
  assert.match(h, /<button class="k-sc-arr" data-a="tray" data-v="1" aria-label="לדמויות הבאות"/);
  assert.match(h, /<button class="k-sc-arr" data-a="tray" data-v="-1" aria-label="לדמויות הקודמות"/);
});
