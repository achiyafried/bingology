import { test } from "node:test";
import assert from "node:assert/strict";
import { newsText, groupByDay, unseenCount, upcomingSeasons, stripItems, formatDateHe } from "../site/lib/news.js";

const TODAY = "2026-11-11";
const S = [
  { tmdbId: 1, n: "Severance", s: 2, strm: { IL: ["Apple TV+", "HOT"], US: ["Apple TV+"], UK: null }, nx: { season: 3, episode: 1, date: "2027-03-14" } },
  { tmdbId: 2, n: "Slow Horses", s: 4, strm: null, nx: null },
  { tmdbId: 3, n: "The Bear", s: 3, strm: { IL: ["Disney Plus"], US: [], UK: [] }, nx: null },
  { tmdbId: 4, n: "Succession", s: 4, strm: { IL: ["HBO Max"], US: [], UK: [] }, nx: null },
  { tmdbId: 5, n: "Gone", s: 2, strm: { IL: [], US: [], UK: [] }, nx: null },
  { tmdbId: 6, n: "USOnly", s: 1, strm: { IL: [], US: ["Max"], UK: [] }, nx: { season: 2, episode: 1, date: "2027-01-01" } },
  { tmdbId: 7, n: "Past", s: 1, nx: { season: 2, episode: 1, date: "2026-11-11" } },
  { tmdbId: 8, n: "Mid", s: 1, nx: { season: 2, episode: 4, date: "2027-02-01" } },
  { tmdbId: 9, n: "Soon", s: 1, nx: { season: 2, episode: 1, date: "2026-12-01" } },
];
const it = (o) => ({ id: "x", date: TODAY, ...o });

test("formatDateHe", () => {
  assert.equal(formatDateHe("2027-03-14"), "14 במרץ 2027");
  assert.equal(formatDateHe("2026-01-05"), "5 בינואר 2026");
});

test("announced", () => {
  const r = newsText(it({ tmdbId: 1, kind: "announced", season: 3, airDate: "2027-03-14" }), S, TODAY);
  assert.deepEqual(r, { tag: "עונה חדשה הוכרזה", kind: "announced", title: "Severance · עונה 3 ב-14 במרץ 2027", sub: "Apple TV+, HOT", region: null });
  const us = newsText(it({ tmdbId: 6, kind: "announced", season: 2, airDate: "2027-01-01" }), S, TODAY);
  assert.equal(us.sub, "Max");
  assert.equal(newsText(it({ tmdbId: 2, kind: "announced", season: 5, airDate: "2027-01-01" }), S, TODAY).sub, "");
});

test("premiere", () => {
  const a = newsText(it({ tmdbId: 2, kind: "premiere", season: 5 }), S, TODAY);
  assert.equal(a.tag, "התחילה היום");
  assert.equal(a.title, "Slow Horses · עונה 5");
  assert.equal(newsText(it({ tmdbId: 2, kind: "premiere", season: 5, date: "2026-11-10" }), S, TODAY).tag, "התחילה");
});

test("stream_added", () => {
  const r = newsText(it({ tmdbId: 3, kind: "stream_added", region: "IL", provider: "Disney Plus" }), S, TODAY);
  assert.deepEqual(r, { tag: "עלתה לסטרימינג", kind: "stream_added", title: "The Bear · Disney Plus", sub: "", region: "IL" });
});

test("stream_removed", () => {
  const S2 = [{ tmdbId: 4, n: "Succession", s: 4, strm: { IL: ["HBO Max"], US: [], UK: [] } }];
  const r = newsText(it({ tmdbId: 4, kind: "stream_removed", region: "UK", provider: "Sky Go" }), S2, TODAY);
  assert.deepEqual(r, { tag: "ירדה מסטרימינג", kind: "stream_removed", title: "Succession · ירדה מ-Sky Go", sub: "עדיין ב-HBO Max", region: "UK" });
  assert.equal(newsText(it({ tmdbId: 5, kind: "stream_removed", region: "UK", provider: "Sky Go" }), S, TODAY).sub, "");
  assert.equal(newsText(it({ tmdbId: 2, kind: "stream_removed", region: "UK", provider: "Sky Go" }), S, TODAY).sub, "");
});

test("ended / canceled", () => {
  const e = newsText(it({ tmdbId: 2, kind: "ended" }), S, TODAY);
  assert.equal(e.tag, "הסתיימה");
  assert.equal(e.sub, "כל הפרקים זמינים לבינג׳");
  const c = newsText(it({ tmdbId: 5, kind: "canceled" }), S, TODAY);
  assert.equal(c.tag, "בוטלה");
  assert.equal(c.sub, "אחרי 2 עונות");
});

test("groupByDay", () => {
  const items = [TODAY, "2026-11-10", "2026-11-06", "2026-10-22"].map((date) => it({ date }));
  const g = groupByDay(items, TODAY);
  assert.deepEqual(g.map((x) => x.label), ["היום", "אתמול", "השבוע", "קודם"]);
  assert.ok(g.every((x) => x.items.length === 1));
  assert.deepEqual(groupByDay([it({ date: "2026-10-01" })], TODAY).map((x) => x.label), ["קודם"]);
  // month boundary
  assert.equal(groupByDay([it({ date: "2026-10-31" })], "2026-11-01")[0].label, "אתמול");
});

test("unseenCount", () => {
  const items = [it({ date: "2026-11-11" }), it({ date: "2026-11-09" })];
  assert.equal(unseenCount(items, null), 2);
  assert.equal(unseenCount(items, "2026-11-11"), 0);
  assert.equal(unseenCount(items, "2026-11-10"), 1);
});

test("upcomingSeasons", () => {
  const u = upcomingSeasons(S, TODAY);
  assert.deepEqual(u, [
    { tmdbId: 9, season: 2, date: "2026-12-01" },
    { tmdbId: 6, season: 2, date: "2027-01-01" },
    { tmdbId: 1, season: 3, date: "2027-03-14" },
  ]);
});

test("stripItems", () => {
  const one = [it({ tmdbId: 3, kind: "stream_added", region: "IL", provider: "X" })];
  const r = stripItems(one, S, TODAY);
  assert.equal(r.length, 3);
  assert.equal(r[0].kind, "stream_added");
  assert.equal(r[1].tmdbId, 9);
  const four = [1, 2, 3, 4].map((tmdbId) => it({ tmdbId, kind: "ended", id: "i" + tmdbId, date: "2026-11-1" + (tmdbId % 2) }));
  const r4 = stripItems(four, S, TODAY);
  assert.equal(r4.length, 3);
  assert.ok(r4.every((x) => x.kind === "ended"));
  // not in S -> skipped; old items don't count as recent
  const mix = [it({ tmdbId: 999, kind: "ended" }), it({ tmdbId: 2, kind: "ended", date: "2026-09-01" })];
  const rm = stripItems(mix, S, TODAY);
  assert.ok(rm.every((x) => x.tmdbId !== 999));
  assert.equal(rm[0].tmdbId, 9);
});
