import { test } from "node:test";
import assert from "node:assert/strict";
import { route, charPath, charProgress, charRows } from "../site/mcu/characters.js";
import { tabsHTML, charsGridHTML, charPathHTML, headerHTML } from "../site/mcu/view.js";

const it = (id, story_i, date, phase) => ({ id, story_i, date, phase, era: "x", story: "s", kind: "movie", name: id, nameHe: null, runtime: 100, fetchedAt: "x", poster: null, providers: [], providersGuess: [] });
const A = it("movie:1", 0, "2011-01-01", 1), B = it("movie:2", 1, "2008-01-01", 1), C = it("movie:3", 2, "2012-01-01", 1);
const thor = { id: "thor", he: "ת'ור", en: "Thor", actor: "Chris Hemsworth", poster: null, apps: [{ id: "movie:1", as: "Thor", cameo: false }, { id: "movie:3", as: "Thor (uncredited)", cameo: true }, { id: "movie:9", as: "Thor", cameo: false }] };
const chars = [thor, { id: "loki", he: "לוקי", en: "Loki", actor: "Tom Hiddleston", poster: "https://image.tmdb.org/t/p/w342/l.jpg", apps: [{ id: "movie:2", as: "Loki", cameo: false }] }];

test("route: timeline by default, the grid, a character, an unknown character → the grid", () => {
  assert.deepEqual(route("", chars), { tab: "timeline", char: null });
  assert.deepEqual(route("#timeline", chars), { tab: "timeline", char: null });
  assert.deepEqual(route("#chars", chars), { tab: "chars", char: null });
  assert.equal(route("#char/thor", chars).char, thor);
  assert.deepEqual(route("#char/nope", chars), { tab: "chars", char: null });
});

test("charPath: only shown titles, in the chosen order, with the name used there", () => {
  assert.deepEqual(charPath([A, B, C], thor, "story").map(p => [p.item.id, p.as, p.cameo]), [["movie:1", "Thor", false], ["movie:3", "Thor (uncredited)", true]]);
  const loki = chars[1];
  assert.deepEqual(charPath([A, B, C], { ...loki, apps: [{ id: "movie:1", as: "Loki" }, { id: "movie:2", as: "Loki" }] }, "release").map(p => p.item.id), ["movie:2", "movie:1"]);
});

test("charProgress and charRows (counts only shown titles)", () => {
  const path = charPath([A, B, C], thor, "story");
  assert.deepEqual(charProgress(path, new Set(["movie:3"])), { done: 1, total: 2 });
  assert.deepEqual(charRows(chars, [A, B, C], new Set(["movie:2"])).map(r => [r.c.id, r.total, r.done]), [["thor", 2, 0], ["loki", 1, 1]]);
});

test("tabsHTML marks the current tab", () => {
  assert.match(tabsHTML("chars"), /href="#chars" aria-current="page"/);
  assert.doesNotMatch(tabsHTML("chars"), /href="#timeline" aria-current/);
});

test("headerHTML on the characters tab has tabs and no list/posters switch", () => {
  const h = headerHTML({ theme: "cosmic", order: "story", view: "list", done: 0, total: 1, tab: "chars" });
  assert.match(h, /href="#chars" aria-current="page"/);
  assert.doesNotMatch(h, /data-a="view"/);
  assert.match(h, /data-a="order"/);
});

test("charsGridHTML: links to each path, title counts, ✓ when all seen, placeholder poster", () => {
  const h = charsGridHTML([{ c: thor, total: 2, done: 2 }, { c: chars[1], total: 1, done: 0 }]);
  assert.match(h, /href="#char\/thor"/);
  assert.match(h, /2 כותרים/);
  assert.match(h, /1 כותר</);
  assert.match(h, /class="ctile done"/);
  assert.match(h, /m-noimg/, "no poster → placeholder");
});

test("charPathHTML: actor, progress, cameo label, per-title name, back link", () => {
  const path = charPath([A, B, C], thor, "story");
  const h = charPathHTML(thor, path, new Set(["movie:1"]));
  assert.match(h, /href="#chars"/);
  assert.match(h, /Chris Hemsworth/);
  assert.match(h, /ראית 1 מתוך 2/);
  assert.match(h, /הופעה קצרה/);
  assert.match(h, /בתור <bdi>Thor<\/bdi>/);
  assert.match(h, /data-a="seen" data-id="movie:3" aria-pressed="false"/);
});
