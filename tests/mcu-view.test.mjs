import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { headerHTML, nextHTML, listHTML, gridHTML, upcomingHTML, cardHTML, lengthText } from "../site/mcu/view.js";

const P = "https://image.tmdb.org/t/p/w342/a.jpg";
const mv = { id: "movie:1", kind: "movie", name: "Iron Man", nameHe: "איירון מן", date: "2008-04-30", runtime: 126, episodes: null, era: "2008–2012", story: "2008", phase: 1, poster: P, overview: "תקציר", vote: 7.7, providers: ["disney"], providersGuess: [], trailer: "dQw4w9WgXcQ" };
const ss = { id: "tv:1:s2", kind: "season", season: 2, name: "Loki <x>", nameHe: null, date: "2023-10-05", runtime: 300, episodes: 6, era: "x", story: "מחוץ לזמן", phase: 5, poster: null, overview: null, overviewEn: "EN", vote: null, providers: [], providersGuess: [], trailer: null, note: "הערה" };

test("headerHTML marks the current choices and shows progress", () => {
  const h = headerHTML({ theme: "comic", order: "release", view: "grid", done: 3, total: 5 });
  assert.match(h, /data-a="theme" data-v="comic" aria-pressed="true"/);
  assert.match(h, /data-a="theme" data-v="cosmic" aria-pressed="false"/);
  assert.match(h, /data-a="order" data-v="release" aria-pressed="true"/);
  assert.match(h, /data-a="view" data-v="grid" aria-pressed="true"/);
  assert.match(h, /ראית 3 מתוך 5/);
  assert.match(h, /href="\.\/"/, "back to Bingology");
});

test("lengthText: movie hours, season episodes", () => {
  assert.equal(lengthText(mv), "סרט · 2:06 שעות");
  assert.equal(lengthText(ss), "סדרה · 6 פרקים", "the season number is already in the title");
  assert.equal(lengthText({ kind: "season", season: 1, episodes: null }), "סדרה");
  assert.equal(lengthText({ kind: "movie", runtime: null }), "סרט");
});

test("nextHTML: the next item, or the finished message", () => {
  assert.match(nextHTML(mv), /הבא בתור/);
  assert.match(nextHTML(mv), /data-a="seen" data-id="movie:1"/);
  assert.match(nextHTML(null), /סיימת את כל ה-MCU! 🎉/);
});

test("listHTML: a heading per group, seen marks pressed, names escaped", () => {
  const h = listHTML([{ title: "2008–2012", items: [mv] }, { title: "<b>", items: [ss] }], new Set(["movie:1"]));
  assert.equal((h.match(/<h3/g) || []).length, 2);
  assert.match(h, /&lt;b&gt;/);
  assert.match(h, /data-a="seen" data-id="movie:1" aria-pressed="true"/);
  assert.match(h, /data-a="seen" data-id="tv:1:s2" aria-pressed="false"/);
  assert.match(h, /<bdi>Loki &lt;x&gt;<\/bdi>/, "English name when there is no Hebrew one");
  assert.match(h, /data-phase="5"/);
});

test("gridHTML: seen tiles are marked; tiles open the card", () => {
  const h = gridHTML([mv, ss], new Set(["tv:1:s2"]));
  assert.match(h, /class="mtile seen"[^>]*data-a="open" data-id="tv:1:s2"/);
  assert.match(h, /class="mtile"[^>]*data-a="open" data-id="movie:1"/);
});

test("upcomingHTML lists the date, and nothing when empty", () => {
  assert.match(upcomingHTML([mv]), /בקרוב/);
  assert.match(upcomingHTML([mv]), /30\.4\.2008/);
  assert.equal(upcomingHTML([]), "");
});

test("cardHTML: note only when present, trailer button only with a trailer, else the search link", () => {
  const a = cardHTML(mv, new Set());
  assert.doesNotMatch(a, /m-note/);
  assert.match(a, /data-a="trail" data-id="movie:1"/);
  assert.match(a, /סימון כנצפה/);
  const b = cardHTML(ss, new Set(["tv:1:s2"]));
  assert.match(b, /class="m-note"/);
  assert.doesNotMatch(b, /data-a="trail"/);
  assert.match(b, /youtube\.com\/results\?search_query=/);
  assert.match(b, /עוד לא ראיתי/);
  assert.match(b, /dir="ltr" lang="en">EN</, "English overview shown left-to-right");
});

test("Bingology's main menu has a Marvel tab, and the home card is gone", () => {
  const src = readFileSync("site/app.js", "utf8");
  const header = /function header\(\) \{[\s\S]*?\n\}/.exec(src)[0];
  assert.match(header, /<a class="tab mcu" href="mcu\.html">/);
  assert.doesNotMatch(src, /class="gcard mcu"/);
});

import { cardSeenHTML } from "../site/mcu/view.js";
test("cardSeenHTML: the card's seen button alone, so marking doesn't repaint (and stop) a playing trailer", () => {
  assert.match(cardSeenHTML({ id: "movie:1" }, false), /class="m-pill primary" data-a="seen" data-id="movie:1" aria-pressed="false">סימון כנצפה</);
  assert.match(cardSeenHTML({ id: "movie:1" }, true), /class="m-pill" data-a="seen" data-id="movie:1" aria-pressed="true">עוד לא ראיתי</);
});

import { focusSelector } from "../site/mcu/view.js";
test("focusSelector finds the same control after a repaint", () => {
  assert.equal(focusSelector({ a: "seen", id: "movie:1" }), '[data-a="seen"][data-id="movie:1"]');
  assert.equal(focusSelector({ a: "theme", v: "hud" }), '[data-a="theme"][data-v="hud"]');
  assert.equal(focusSelector({ a: "seen", id: 'x"]' }), null, "odd ids are not put in a selector");
  assert.equal(focusSelector({}), null);
});

test("the MCU page handles the copy-link button from the trailer search row", () => {
  assert.match(readFileSync("site/mcu/app.js", "utf8"), /a === "copylink"/);
});
