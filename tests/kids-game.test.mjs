import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MISSES, PX, puzzleFor, initGame, guess, blur, outcome } from "../site/kids/game.js";
import { loadAge, saveAge, loadGame, saveGame } from "../site/kids/store.js";

const s = (tmdb, age = "mid", poster = `/${tmdb}.jpg`) => ({ tmdb, age, poster, vote: tmdb, name: `S${tmdb}`, nameHe: null });
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => s(n)).concat([s(20, "small")]);

test("constants", () => {
  assert.equal(MAX_MISSES, 3);
  assert.deepEqual(PX, [28, 18, 10, 0]);
});

test("same date and group give the same puzzle", () => {
  assert.deepEqual(puzzleFor(items, "2026-11-19", "mid"), puzzleFor(items, "2026-11-19", "mid"));
});

test("different dates give different answers", () => {
  const answers = new Set();
  for (let d = 10; d < 20; d++) answers.add(puzzleFor(items, `2026-11-${d}`, "mid").answer);
  assert.ok(answers.size >= 2, [...answers].join(","));
});

test("4 distinct choices from the group, one of them the answer", () => {
  const p = puzzleFor(items, "2026-11-19", "mid");
  assert.equal(p.choices.length, 4);
  assert.equal(new Set(p.choices).size, 4);
  assert.ok(p.choices.includes(p.answer));
  assert.ok(p.choices.every(id => id >= 1 && id <= 10));
});

test("small groups: 3 eligible → 3 choices, 1 → no puzzle", () => {
  assert.equal(puzzleFor([s(1), s(2), s(3)], "2026-11-19", "mid").choices.length, 3);
  assert.equal(puzzleFor([s(1)], "2026-11-19", "mid"), null);
  assert.equal(puzzleFor([], "2026-11-19", "mid"), null);
});

test("series without a poster are never in the puzzle", () => {
  const list = [s(1), s(2, "mid", null), s(3), s(4, "mid", null)];
  for (let d = 10; d < 30; d++) {
    const p = puzzleFor(list, `2026-11-${d}`, "mid");
    assert.ok(p.choices.every(id => id === 1 || id === 3));
  }
});

test("a wrong guess clears the blur a step; three misses lose", () => {
  const p = { answer: 1, choices: [1, 2, 3, 4] };
  let st = initGame(p);
  assert.equal(blur(st), 28);
  st = guess(st, 2);
  assert.equal(blur(st), 18);
  assert.equal(outcome(st), null);
  st = guess(st, 2); // repeated: ignored
  assert.deepEqual(st.misses, [2]);
  st = guess(guess(st, 3), 4);
  assert.equal(st.done, true);
  assert.equal(outcome(st), "lose");
  assert.equal(blur(st), 0);
  assert.equal(guess(st, 1), st);
});

test("the right guess wins; unknown choices are ignored", () => {
  const p = { answer: 1, choices: [1, 2, 3, 4] };
  let st = guess(initGame(p), 99);
  assert.deepEqual(st.misses, []);
  st = guess(st, 1);
  assert.equal(outcome(st), "win");
  assert.equal(blur(st), 0);
});

test("with 2 choices one miss ends the game", () => {
  const st = guess(initGame({ answer: 1, choices: [2, 1] }), 2);
  assert.equal(st.done, true);
  assert.equal(outcome(st), "lose");
});

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };

test("loadAge falls back to mid", () => {
  const st = mem();
  assert.equal(loadAge(st), "mid");
  st.setItem("bingology:kids-age", "xyz");
  assert.equal(loadAge(st), "mid");
  assert.equal(loadAge(broken), "mid");
  assert.equal(loadAge(null), "mid");
  saveAge(st, "big");
  assert.equal(loadAge(st), "big");
  saveAge(broken, "big"); // does not throw
});

test("saved games round-trip per group and are ignored when the puzzle changed", () => {
  const st = mem();
  const g = { answer: 5, choices: [5, 2, 3, 4], misses: [2], done: false };
  const P5 = { answer: 5, choices: [5, 2, 3, 4] };
  saveGame(st, "2026-11-19", "mid", g);
  saveGame(st, "2026-11-19", "big", { answer: 7, misses: [], done: true });
  assert.deepEqual(loadGame(st, "2026-11-19", "mid", P5), g);
  assert.equal(loadGame(st, "2026-11-19", "mid", { answer: 6, choices: [6, 2, 3, 4] }), null);
  assert.equal(loadGame(st, "2026-11-19", "small", P5), null);
  assert.equal(loadGame(st, "2026-11-18", "mid", P5), null);
  st.setItem("bingology:kids-game:2026-11-20", "{bad");
  assert.equal(loadGame(st, "2026-11-20", "mid", P5), null);
  assert.equal(loadGame(broken, "2026-11-19", "mid", P5), null);
  assert.equal(loadGame(null, "2026-11-19", "mid", P5), null);
  saveGame(null, "2026-11-19", "mid", g);
});

test("a saved game with other choices than today's puzzle is ignored", () => {
  const st = mem();
  saveGame(st, "2026-11-19", "mid", { answer: 5, choices: [5, 1, 2, 3], misses: [1], done: false, won: false });
  assert.equal(loadGame(st, "2026-11-19", "mid", { answer: 5, choices: [5, 1, 2, 4] }), null);
  assert.equal(loadGame(st, "2026-11-19", "mid", { answer: 5, choices: [3, 2, 1, 5] }).misses[0], 1);
});
