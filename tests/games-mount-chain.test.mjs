// mountGames with a chain-only day: the hint move, stored `hinted`, and the how-to line.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = { scrollY: 0, scrollTo() {} };
const { mountGames } = await import("../site/views/games.js");

const TODAY = "2026-11-13";
const chain = { from: 1, to: 3, shortest: 2, limit: 4, series: {
  1: { name: "From", poster: null, cast: ["D", "X"] },
  2: { name: "Mid", poster: null, cast: ["X", "Y"] },
  3: { name: "To", poster: null, cast: ["Y"] },
} };
const day = { date: TODAY, v: 1, used: {}, games: { chain } };
const KEY = "bingology:games:" + TODAY;

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
}
const root = { innerHTML: "", isConnected: true, contains: () => true, addEventListener() {}, querySelector: () => null };
const storage = memStorage();
const ctx = { S: [], storage, actorNames: [], today: () => TODAY, fetch: async () => ({ status: 200, ok: true, json: async () => day }),
  openSeries() {}, openActor() {}, toast() {}, copy: async () => true, nav: true };
const click = d => root.onclick({ target: { closest: () => ({ dataset: d, disabled: false }) } });

storage.setItem(KEY, JSON.stringify({ chain: { path: [1], via: [], steps: 0, done: false, hinted: "yes" } }));
mountGames(root, ctx);
await new Promise(r => setTimeout(r, 10));

test("a stored chain state with a non-boolean hinted starts over", () => {
  assert.match(root.innerHTML, /data-g="chain"/);
  assert.match(root.innerHTML, /לשחק/);
});

test("the game screen shows the how-to line under the title", () => {
  click({ g: "chain" });
  assert.match(root.innerHTML, /<\/h2><p class="g-how">המטרה: להגיע מ-<bdi>From<\/bdi> ל-<bdi>To<\/bdi>\./);
});

test("hint highlights the next actor and stores hinted: true", () => {
  assert.doesNotMatch(root.innerHTML, /is-hint/);
  click({ ghint: "" });
  assert.match(root.innerHTML, /class="chip is-hint" data-gact="X"/);
  assert.equal(JSON.parse(storage.getItem(KEY)).chain.hinted, true);
  click({ gact: "X" });
  click({ gto: "2" });
  assert.doesNotMatch(root.innerHTML, /is-hint/, "the hint belongs to the series it was asked in");
  click({ gact: "Y" });
  click({ gto: "3" });
  assert.match(root.innerHTML, /הגעתם!/);
  assert.doesNotMatch(root.innerHTML, /מושלם/);
});
