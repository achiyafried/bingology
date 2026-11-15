// mountGames: the tab button returns to the hub; a friend can play on the same phone without touching my results.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = { scrollY: 0, scrollTo() {} };
const { mountGames } = await import("../site/views/games.js");
const { loadDay, streak } = await import("../site/lib/games/store.js");

const TODAY = "2026-11-13";
const IMG = "https://image.tmdb.org/t/p/w342/abc.jpg";
const day = {
  date: TODAY, v: 1, used: {},
  games: {
    guess: { answer: { id: 999, name: "Zzyzx Road", poster: IMG }, clues: [{ kind: "genreYear", text: "דרמה · 2008" }] },
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
const storage = memStorage();
const ctx = (extra = {}) => ({
  S: [{ tmdbId: 1, n: "Breaking Bad" }], storage, actorNames: ["Bryan Cranston"], today: () => TODAY,
  fetch: async () => ({ status: 200, ok: true, json: async () => day }),
  openSeries() {}, openActor() {}, toast() {}, copy: async () => true, ...extra,
});
const tick = () => new Promise(r => setTimeout(r, 10));
const click = (root, d) => root.onclick({ target: { closest: () => ({ dataset: d, disabled: false }) } });

let root = fakeRoot();
mountGames(root, ctx({ nav: true }));
await tick();

test("the games tab button returns from an open game to the hub", () => {
  click(root, { g: "guess" });
  assert.match(root.innerHTML, /g-guess/);
  root = fakeRoot();
  mountGames(root, ctx({ nav: true }));
  assert.match(root.innerHTML, /g-guess/, "a plain re-render keeps the open game");
  root = fakeRoot();
  mountGames(root, ctx({ nav: true, home: true }));
  assert.doesNotMatch(root.innerHTML, /g-guess/);
  assert.match(root.innerHTML, /המשחקים של היום/);
});

test("the friend button shows only after I played something", () => {
  assert.doesNotMatch(root.innerHTML, /data-gguest/);
  click(root, { g: "blur" });
  click(root, { gpick: "Qwerty Unlisted" });
  click(root, { ghub: "" });
  assert.match(root.innerHTML, /data-gguest/);
});

test("a friend's round starts clean and never touches my saved results or streak", () => {
  const mine = JSON.stringify(loadDay(storage, TODAY));
  click(root, { gguest: "" });
  assert.match(root.innerHTML, /משחק של חבר/);
  assert.match(root.innerHTML, /לשחק/);
  assert.doesNotMatch(root.innerHTML, /סיים/);
  click(root, { g: "blur" });
  click(root, { gpick: "Wrong Name" });
  click(root, { g: "guess" });
  click(root, { gpick: "999" });
  assert.equal(JSON.stringify(loadDay(storage, TODAY)), mine);
  assert.equal(streak(storage, TODAY), 0);
});

test("ending the friend's round brings back my own results", () => {
  click(root, { ghub: "" });
  click(root, { gguestend: "" });
  assert.doesNotMatch(root.innerHTML, /משחק של חבר/);
  assert.match(root.innerHTML, /סיים/);
});

test("the tab button also ends a friend's round", () => {
  click(root, { gguest: "" });
  root = fakeRoot();
  mountGames(root, ctx({ nav: true, home: true }));
  assert.doesNotMatch(root.innerHTML, /משחק של חבר/);
});
