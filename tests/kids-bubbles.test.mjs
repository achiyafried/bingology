import test from "node:test";
import assert from "node:assert/strict";
import { pickBubble, bubbleHTML, MAX_BUBBLES, SPAWN_MS } from "../site/kids/bubbles.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const it = (tmdb, o = {}) => ({ tmdb, name: `S${tmdb}`, age: "small", backdrop: B, ...o });
const seeded = () => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test("constants", () => { assert.equal(MAX_BUBBLES, 6); assert.equal(SPAWN_MS, 1200); });

test("pickBubble: a character, a spot, a slow rise and a big size", () => {
  const items = [it(1, { cutout: true }), it(2), it(3, { age: "mid" })];
  const rnd = seeded();
  for (let k = 0; k < 50; k++) {
    const b = pickBubble(items, rnd, k);
    assert.ok([1, 2].includes(b.tmdb));
    assert.ok(b.x >= 0.16 && b.x <= 0.84); // a whole bubble stays inside a phone-wide area
    assert.ok(b.dur >= 8 && b.dur <= 12);
    assert.ok(b.size >= 80 && b.size <= 110);
    assert.equal(b.id, k);
  }
  assert.equal(pickBubble([], rnd, 0), null);
});

test("bubbleHTML: cut-out inside when there is one, else the round sticker; slower with reduced motion", () => {
  const cut = bubbleHTML({ id: 4, tmdb: 1, x: 0.5, dur: 10, size: 90 }, it(1, { cutout: true }), false);
  assert.match(cut, /^<button class="k-bub" data-a="pop" data-b="4" aria-label="S1"/);
  assert.match(cut, /left:50%/); assert.match(cut, /width:90px/); assert.match(cut, /animation-duration:10s/);
  assert.match(cut, /<img src="kids\/chars\/1\.png"/);
  const round = bubbleHTML({ id: 5, tmdb: 2, x: 0.2, dur: 9, size: 80 }, it(2, { name: "<b>" }), true);
  assert.match(round, /animation-duration:27s/);
  assert.match(round, /background-image:url\(https:\/\/image\.tmdb\.org/);
  assert.doesNotMatch(round, /<b>/);
});
