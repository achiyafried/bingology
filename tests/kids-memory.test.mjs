import test from "node:test";
import assert from "node:assert/strict";
import { pairsFor, deal, flip, settle, won, memoryHTML } from "../site/kids/memory.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const mk = n => Array.from({ length: n }, (_, i) => ({ tmdb: i + 1, name: `s${i + 1}`, backdrop: B, age: "small" }));
const seeded = () => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const idx = (st, t) => st.cards.flatMap((c, i) => (c.tmdb === t ? [i] : []));

test("pairsFor: 3 below level 3, 4 from 3", () => {
  assert.equal(pairsFor(0), 3);
  assert.equal(pairsFor(2), 3);
  assert.equal(pairsFor(3), 4);
});

test("deal: each of 3 distinct series twice; fewer series -> fewer cards", () => {
  const st = deal(mk(6), 3, seeded());
  assert.equal(st.cards.length, 6);
  assert.equal(st.busy, false);
  const counts = {};
  for (const c of st.cards) { counts[c.tmdb] = (counts[c.tmdb] || 0) + 1; assert.equal(c.open, false); assert.equal(c.matched, false); }
  assert.equal(Object.keys(counts).length, 3);
  assert.ok(Object.values(counts).every(n => n === 2));
  assert.equal(deal(mk(2), 3, seeded()).cards.length, 4);
});

test("flip: match marks both; mismatch is busy; busy ignores taps; settle closes", () => {
  let st = deal(mk(4), 3, seeded());
  const [a, b] = idx(st, st.cards[0].tmdb);
  st = flip(flip(st, a), b);
  assert.ok(st.cards[a].matched && st.cards[b].matched);
  assert.equal(st.busy, false);
  const rest = st.cards.map((c, i) => i).filter(i => !st.cards[i].matched);
  const x = rest[0], y = rest.find(i => st.cards[i].tmdb !== st.cards[x].tmdb), z = rest.find(i => i !== x && i !== y);
  st = flip(flip(st, x), y);
  assert.equal(st.busy, true);
  assert.equal(flip(st, z), st);
  st = settle(st);
  assert.equal(st.busy, false);
  assert.ok(st.cards.every(c => !c.open || c.matched));
});

test("flip: matched or open card is a no-op", () => {
  let st = deal(mk(3), 3, seeded());
  const [a, b] = idx(st, st.cards[0].tmdb);
  st = flip(st, a);
  assert.equal(flip(st, a), st);
  st = flip(st, b);
  assert.equal(flip(st, a), st);
});

test("won after all pairs", () => {
  let st = deal(mk(3), 3, seeded());
  assert.equal(won(st), false);
  for (const t of [1, 2, 3]) { const [a, b] = idx(st, t); st = flip(flip(st, a), b); }
  assert.equal(won(st), true);
});

test("memoryHTML: back ❓ with aria-label, open card shows sticker and name", () => {
  let st = deal(mk(3), 3, seeded());
  let html = memoryHTML(st, mk(3));
  assert.match(html, /aria-label="קלף"/);
  assert.match(html, /❓/);
  st = flip(st, 0);
  html = memoryHTML(st, mk(3));
  assert.match(html, /aria-label="s\d"/);
  assert.match(html, /background-image:url\(/);
  assert.match(html, /data-a="mem-flip" data-v="0"/);
});

test("memoryHTML: win shows again and home", () => {
  let st = deal(mk(3), 3, seeded());
  for (const t of [1, 2, 3]) { const [a, b] = idx(st, t); st = flip(flip(st, a), b); }
  const html = memoryHTML(st, mk(3));
  assert.match(html, /data-a="mem-again"/);
  assert.match(html, /k-confetti/);
});
