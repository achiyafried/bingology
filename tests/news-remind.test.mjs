import { test } from "node:test";
import assert from "node:assert/strict";
import { remindInfo, googleCalUrl, icsText, waUrl, actionsHTML, remindMenuHTML, fold } from "../site/lib/remind.js";
import { rowHTML } from "../site/lib/news.js";

const TODAY = "2026-11-24";
const S = [{ tmdbId: 95396, n: "Severance", strm: { IL: ["Apple TV+"], US: ["Apple TV+"] }, poster: null }];

test("remindInfo: upcoming seasons and future announced seasons only", () => {
  assert.deepEqual(remindInfo({ tmdbId: 95396, season: 3, date: "2027-03-14" }, S, TODAY),
    { tmdbId: 95396, name: "Severance", season: 3, date: "2027-03-14", where: "Apple TV+" });
  assert.equal(remindInfo({ kind: "announced", tmdbId: 95396, season: 3, airDate: "2027-03-14", date: "2026-11-20" }, S, TODAY).date, "2027-03-14");
  assert.equal(remindInfo({ kind: "announced", tmdbId: 95396, season: 3, airDate: "2026-11-24", date: "2026-11-20" }, S, TODAY), null);
  assert.equal(remindInfo({ kind: "premiere", tmdbId: 95396, season: 3, date: TODAY }, S, TODAY), null);
  assert.equal(remindInfo({ kind: "ended", tmdbId: 95396, date: TODAY }, S, TODAY), null);
  assert.equal(remindInfo({ tmdbId: 1, season: 2, date: "2027-01-01" }, S, TODAY), null);
  assert.equal(remindInfo({ tmdbId: 95396, season: 3, date: "2027-3-1" }, S, TODAY), null);
});

const info = { tmdbId: 95396, name: "Severance", season: 3, date: "2027-03-14", where: "Apple TV+" };

test("googleCalUrl: an all-day event on the premiere date", () => {
  const u = new URL(googleCalUrl(info));
  assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("dates"), "20270314/20270315");
  assert.equal(u.searchParams.get("text"), "🎬 Severance: עונה 3 מתחילה");
  assert.match(u.searchParams.get("details"), /Apple TV\+/);
  assert.equal(new URL(googleCalUrl({ ...info, date: "2027-12-31" })).searchParams.get("dates"), "20271231/20280101");
});

test("icsText: a valid all-day event with an alarm at 9:00 the day before", () => {
  const t = icsText({ ...info, name: "A, B; C\\D" }, "2026-11-24T10:00:00Z");
  assert.ok(t.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(t.endsWith("END:VCALENDAR\r\n"));
  assert.doesNotMatch(t.replace(/\r\n/g, ""), /\n/);
  assert.match(t, /\r\nDTSTART;VALUE=DATE:20270314\r\n/);
  assert.match(t, /\r\nDTEND;VALUE=DATE:20270315\r\n/);
  assert.match(t, /\r\nDTSTAMP:20261124T100000Z\r\n/);
  assert.match(t, /\r\nUID:bingology-95396-s3-20270314@achiyafried\.github\.io\r\n/);
  assert.match(t, /\r\nSUMMARY:🎬 A\\, B\\; C\\\\D: עונה 3 מתחילה\r\n/);
  assert.match(t, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:-PT15H\r\nEND:VALARM/);
});

test("waUrl: WhatsApp with the Hebrew message and the site link", () => {
  const u = new URL(waUrl(info));
  assert.equal(u.origin + u.pathname, "https://wa.me/");
  assert.equal(u.searchParams.get("text"), "עונה 3 של \u2068Severance\u2069 מתחילה ב-14 במרץ 2027! 🎉 מתכננים בינג׳? https://achiyafried.github.io/bingology/");
});

test("actionsHTML: the two buttons, escaped", () => {
  const h = actionsHTML({ ...info, name: "<x>" });
  assert.match(h, /data-a="nremind" data-t="95396" data-s="3" data-d="2027-03-14" aria-expanded="false" aria-controls="nm-95396-3" aria-label="תזכורת לבכורה של &lt;x&gt;"/);
  assert.match(h, /<a class="nact-b nwa" href="https:\/\/wa\.me\/\?text=[^"]+" target="_blank" rel="noopener noreferrer" aria-label="שיתוף בוואטסאפ של &lt;x&gt; \(נפתח בלשונית חדשה\)"/);
  assert.doesNotMatch(h, /<x>/);
});

test("rowHTML: an upcoming row carries the buttons beside it; other rows don't", () => {
  const up = rowHTML({ tmdbId: 95396, season: 3, date: "2027-03-14" }, S, TODAY, false);
  assert.match(up, /^<div class="nrow"><button class="n" data-a="detail"/);
  assert.match(up, /data-a="nremind"/);
  const ended = rowHTML({ kind: "ended", tmdbId: 95396, date: TODAY, id: "x" }, S, TODAY, false);
  assert.match(ended, /^<button class="n"/);
  assert.doesNotMatch(ended, /nremind/);
});

test("remindMenuHTML: a plain group (no fake menu role) with the id the trigger controls", () => {
  const h = remindMenuHTML(info);
  assert.match(h, /^<div class="nmenu" id="nm-95396-3" role="group" aria-label="/);
  assert.doesNotMatch(h, /role="menu/);
  assert.match(h, /data-a="nics"/);
});

test("fold: lines over 75 octets wrap with CRLF+space, never inside a character", () => {
  const long = "DESCRIPTION:" + "איפה רואים: ".repeat(12) + "🎬🎬🎬";
  const f = fold(long);
  const parts = f.split("\r\n");
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 75, p);
  assert.equal(parts.map((p, k) => (k ? p.slice(1) : p)).join(""), long);
  assert.ok(parts.slice(1).every(p => p.startsWith(" ")));
  assert.equal(fold("SHORT:x"), "SHORT:x");
});

test("icsText: long lines are folded", () => {
  const t = icsText({ ...info, where: "Amazon Prime Video, Philo, Starz Amazon Channel, Spectrum On Demand, Starz" }, "2026-11-24T10:00:00Z");
  for (const line of t.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("waUrl: the series name is bidi-isolated inside the Hebrew sentence", () => {
  assert.match(new URL(waUrl(info)).searchParams.get("text"), /של \u2068Severance\u2069 מתחילה/);
});
