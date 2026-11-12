import { test } from "node:test";
import assert from "node:assert/strict";
import { letters, init, play, result } from "../site/lib/games/riddle.js";

const p = { clue: "הוא נשאר בתוך הים אז הם שרדו", answer: "הנותרים", words: [7], tmdbId: 54344 };
const typeAll = (s, str) => { for (const ch of str) s = play(s, p, { type: "type", ch }); return s; };

test("letters normalizes finals and drops non-letters", () => {
  assert.deepEqual(letters("הנותרים"), ["ה", "נ", "ו", "ת", "ר", "י", "מ"]);
  assert.deepEqual(letters(" ה'נותרימ "), letters("הנותרים"));
  assert.deepEqual(letters("ךםןףץ"), ["כ", "מ", "נ", "פ", "צ"]);
});

test("typing fills up to the answer length; non-Hebrew is ignored", () => {
  const s = typeAll(init(p), "הנותריםא");
  assert.equal(s.letters.length, 7);
  assert.equal(play(s, p, { type: "type", ch: "א" }), s);
  const s0 = init(p);
  assert.equal(play(s0, p, { type: "type", ch: "a" }), s0);
  assert.equal(play(s0, p, { type: "type", ch: "הנ" }), s0);
});

test("del removes the last typed letter but never a hinted one", () => {
  let s = typeAll(init(p), "הנ");
  s = play(s, p, { type: "del" });
  assert.deepEqual(s.letters, ["ה"]);
  s = play(init(p), p, { type: "hint" });
  assert.equal(play(s, p, { type: "del" }), s);
  s = play(s, p, { type: "type", ch: "ש" });
  assert.deepEqual(play(s, p, { type: "del" }).letters, ["ה"]);
});

test("check: not full does nothing; full and wrong counts a try; full and correct wins", () => {
  const part = typeAll(init(p), "הנו");
  assert.equal(play(part, p, { type: "check" }), part);
  const wrong = play(typeAll(init(p), "הנותרון"), p, { type: "check" });
  assert.equal(wrong.tries, 1); assert.equal(wrong.last, "wrong"); assert.equal(wrong.done, false);
  const typed = play(wrong, p, { type: "del" });
  assert.equal(typed.last, undefined, "a new keystroke clears the wrong marker");
  const win = play(typeAll(init(p), "הנותרים"), p, { type: "check" });
  assert.equal(win.done, true); assert.equal(win.gaveUp, false);
});

test("typing a regular letter where the answer has a final one still wins", () => {
  assert.equal(play(typeAll(init(p), "הנותרימ"), p, { type: "check" }).done, true);
});

test("hint reveals the next correct letter, drops letters after it, stops at n-1", () => {
  let s = typeAll(init(p), "השש");
  s = play(s, p, { type: "hint" });
  assert.deepEqual(s.letters, ["ה"]);
  assert.equal(s.hints, 1);
  for (let i = 0; i < 10; i++) s = play(s, p, { type: "hint" });
  assert.equal(s.hints, 6);
  assert.deepEqual(s.letters, letters("הנותרי"));
  assert.equal(s.done, false);
});

test("reveal ends without a win; moves after done are ignored", () => {
  const s = play(typeAll(init(p), "הנ"), p, { type: "reveal" });
  assert.equal(s.done, true); assert.equal(s.gaveUp, true);
  assert.equal(play(s, p, { type: "type", ch: "ו" }), s);
  assert.equal(play(s, p, { type: "hint" }), s);
  assert.equal(play(s, p, null), s);
});

test("labels", () => {
  const win = s => play(typeAll(s, "הנותרים".slice(s.letters.length)), p, { type: "check" });
  assert.deepEqual(result(init(p), p), { done: false, win: false, score: null, label: "" });
  assert.deepEqual(result(win(init(p)), p), { done: true, win: true, score: 0, label: "✓" });
  assert.equal(result(win(play(init(p), p, { type: "hint" })), p).label, "רמז 1");
  let s = init(p); for (let i = 0; i < 3; i++) s = play(s, p, { type: "hint" });
  assert.deepEqual(result(win(s), p), { done: true, win: true, score: 3, label: "3 רמזים" });
  assert.deepEqual(result(play(init(p), p, { type: "reveal" }), p), { done: true, win: false, score: null, label: "✗" });
});

test("multi-word answers compare letters only", () => {
  const q = { answer: "שובר שורות", words: [4, 5] };
  let s = init(q); for (const ch of "שוברשורות") s = play(s, q, { type: "type", ch });
  assert.equal(s.letters.length, 9);
  assert.equal(play(s, q, { type: "check" }).done, true);
});
