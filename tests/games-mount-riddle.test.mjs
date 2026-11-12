// The riddle's hidden input against a stub DOM: phone keyboards need the same input element to stay
// focused (no repaint per keystroke), a delete that works without a "Backspace" keydown, and IME composition.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.window = { scrollY: 0, scrollTo() {} };
const { mountGames, hiddenMoves, SENTINEL } = await import("../site/views/games.js");

const TODAY = "2026-11-13";
const day = { date: TODAY, v: 1, used: {}, games: { riddle: { clue: "הוא נשאר בתוך הים אז הם שרדו", answer: "הנותרים", words: [7], tmdbId: 54344 } } };
const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } }; };
const listeners = {};
const gr = { id: "gr", value: SENTINEL, focus() {} };
const play = { innerHTML: "" };
const root = {
  innerHTML: "", isConnected: true, contains: () => true,
  addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  querySelector: s => ({ "#gr": gr, ".g-rplay": play })[s] ?? null,
};
const tick = () => new Promise(r => setTimeout(r, 10));
const click = d => root.onclick({ target: { closest: () => ({ dataset: d, disabled: false }) } });
const input = (value, extra = {}) => { gr.value = value; root.oninput({ target: gr, inputType: "insertText", isComposing: false, ...extra }); };
const boxes = () => [...play.innerHTML.matchAll(/class="g-box[^"]*">([^<]*)</g)].map(m => m[1]).join("");

mountGames(root, { S: [], storage: memStorage(), actorNames: [], today: () => TODAY, fetch: async () => ({ status: 200, ok: true, json: async () => day }), openSeries() {}, openActor() {}, toast() {}, copy: async () => true, nav: true });
await tick();
click({ g: "riddle" });

test("hiddenMoves: typed and pasted letters, delete by inputType, composition text ignored", () => {
  assert.deepEqual(hiddenMoves(SENTINEL + "ה", "insertText"), [{ type: "type", ch: "ה" }]);
  assert.deepEqual(hiddenMoves(SENTINEL + "ה נ", "insertFromPaste"), [{ type: "type", ch: "ה" }, { type: "type", ch: " " }, { type: "type", ch: "נ" }]);
  assert.deepEqual(hiddenMoves("", "deleteContentBackward"), [{ type: "del" }]);
  assert.deepEqual(hiddenMoves("", "insertText"), [{ type: "del" }], "the sentinel was deleted: some keyboards report no inputType");
  assert.deepEqual(hiddenMoves(SENTINEL, "insertText"), []);
});

test("typing patches only the play area: the focused input is never replaced", () => {
  const page = root.innerHTML;
  input(SENTINEL + "ה");
  input(SENTINEL + "נ");
  assert.equal(root.innerHTML, page, "no full repaint while playing");
  assert.equal(boxes(), "הנ");
  assert.equal(gr.value, SENTINEL, "the field is reset to the sentinel");
});

test("delete without a Backspace keydown (Android) still removes a letter", () => {
  input("", { inputType: "deleteContentBackward" });
  assert.equal(boxes(), "ה");
});

test("letters typed during IME composition are applied once, at compositionend", () => {
  input(SENTINEL + "נו", { isComposing: true });
  assert.equal(boxes(), "ה", "nothing applied mid-composition");
  gr.value = SENTINEL + "נו";
  for (const f of listeners.compositionend || []) f({ target: gr });
  assert.equal(boxes(), "הנו");
});

test("solving repaints the whole screen with the end view", () => {
  input(SENTINEL + "תרים");
  root.onkeydown({ target: gr, key: "Enter", isComposing: false, preventDefault() {} });
  assert.match(root.innerHTML, /g-end/);
});

test("the hidden input is at least 16px so iOS does not zoom on focus", () => {
  const css = readFileSync("site/styles.css", "utf8");
  const rule = css.match(/\.g-hidden\s*\{([^}]*)\}/);
  assert.ok(rule, ".g-hidden rule exists");
  assert.match(rule[1], /font-size:\s*(1[6-9]|[2-9]\d)px/);
});
