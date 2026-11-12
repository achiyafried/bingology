// mountGames against a stub DOM: remount behaviour, suggestions, share fallback.
import { test } from "node:test";
import assert from "node:assert/strict";

const scrolls = [];
globalThis.window = { scrollY: 240, scrollTo: (x, y) => scrolls.push(y) };
const { mountGames } = await import("../site/views/games.js");
const { loadTotal } = await import("../site/lib/games/store.js");

const TODAY = "2026-11-13";
const IMG = "https://image.tmdb.org/t/p/w342/abc.jpg";
const card = (id, name) => ({ id, name, poster: IMG });
const day = {
  date: TODAY, v: 1, used: {},
  games: {
    guess: { answer: card(999, "Zzyzx Road"), clues: [{ kind: "genreYear", text: "דרמה · 2008" }] },
    blur: { actor: { name: "Qwerty Unlisted", photo: IMG }, count: 3, series: ["A", "B", "C"] },
  },
};

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
}
function fakeRoot() {
  const els = { "#gq": { value: "", focus() {} }, "#gsug": { innerHTML: "" } };
  return { innerHTML: "", isConnected: true, contains: () => true, addEventListener() {}, querySelector: s => els[s] ?? null, els };
}
const toasts = [];
let copyOk = true;
const ctx = (extra = {}) => ({
  S: [{ tmdbId: 1, n: "Breaking Bad" }], storage, actorNames: ["Bryan Cranston"], today: () => TODAY,
  fetch: async () => ({ status: 200, ok: true, json: async () => day }),
  openSeries() {}, openActor() {}, toast: (...a) => toasts.push(a), copy: async () => copyOk, ...extra,
});
const storage = memStorage();
const tick = () => new Promise(r => setTimeout(r, 10));
const click = (root, d) => root.onclick({ target: { closest: () => ({ dataset: d, disabled: false }) } });
const type = (root, value) => { root.els["#gq"].value = value; root.oninput({ target: { id: "gq", value } }); };

let root = fakeRoot();
mountGames(root, ctx({ nav: true }));
await tick();

test("loading a day records how many games it has", () => {
  assert.equal(loadTotal(storage, TODAY), 2);
});

test("guess suggestions include the answer even when it is not in the series list", () => {
  click(root, { g: "guess" });
  type(root, "zzy");
  assert.match(root.els["#gsug"].innerHTML, /data-gpick="999"/);
  assert.match(root.els["#gsug"].innerHTML, /Zzyzx Road/);
  type(root, "breaking");
  assert.doesNotMatch(root.els["#gsug"].innerHTML, /999/);
});

test("remounting an open game keeps scroll and the typed text; navigation scrolls to top", () => {
  root.els["#gq"].value = "Brea";
  const next = fakeRoot();
  scrolls.length = 0;
  mountGames(next, ctx());
  assert.deepEqual(scrolls, [240]);
  assert.equal(next.els["#gq"].value, "Brea");
  assert.match(next.innerHTML, /g-guess/);
  root = fakeRoot();
  scrolls.length = 0;
  mountGames(root, ctx({ nav: true }));
  assert.deepEqual(scrolls, [0]);
  assert.equal(root.els["#gq"].value, "");
});

test("blur suggestions include the answer even when it is not among the actors", () => {
  click(root, { g: "blur" });
  type(root, "qwe");
  assert.match(root.els["#gsug"].innerHTML, /data-gpick="Qwerty Unlisted"/);
  click(root, { gpick: "Qwerty Unlisted" });
  assert.match(root.innerHTML, /ניחשתם ב-1/);
});

test("share fallback keeps the multi-line text out of the one-line toast", async () => {
  click(root, { g: "guess" });
  click(root, { gpick: "999" });
  click(root, { ghub: "" });
  assert.match(root.innerHTML, /data-gshare/);
  copyOk = false;
  toasts.length = 0;
  click(root, { gshare: "" });
  await tick();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].length, 1, "no text field in the toast");
  copyOk = true;
  toasts.length = 0;
  click(root, { gshare: "" });
  await tick();
  assert.deepEqual(toasts, [["התוצאות הועתקו"]]);
});
