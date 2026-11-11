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

test("stripItems: no duplicate series between items and upcoming", () => {
  const r = stripItems([it({ tmdbId: 9, kind: "announced", season: 2, airDate: "2026-12-01" })], S, TODAY);
  assert.deepEqual(r.map((x) => x.tmdbId), [9, 6, 1]);
  assert.equal(r[0].kind, "announced");
  assert.equal(r.filter((x) => x.tmdbId === 9).length, 1);
});

test("stripItems: recent, then upcoming, then older items; cap 3", () => {
  const noUp = S.filter((s) => s.tmdbId !== 9 && s.tmdbId !== 6 && s.tmdbId !== 1);
  const older = [it({ tmdbId: 2, kind: "ended", date: "2026-10-01" }), it({ tmdbId: 3, kind: "ended", date: "2026-10-20" })];
  const r = stripItems(older, noUp, TODAY);
  assert.deepEqual(r.map((x) => x.tmdbId), [3, 2], "older items shown, newest first, when nothing else");
  const mixed = stripItems([...older, it({ tmdbId: 4, kind: "ended", date: "2026-11-09" })], S.filter((s) => s.tmdbId !== 6 && s.tmdbId !== 1), TODAY);
  assert.deepEqual(mixed.map((x) => x.tmdbId), [4, 9, 3]);
  assert.equal(stripItems([], [], TODAY).length, 0);
});

/* ───────── render: bell, strip (site/lib/news.js), page (site/views/news.js) ───────── */
import { bellHTML, stripHTML } from "../site/lib/news.js";
import { newsPageHTML, FILTERS } from "../site/views/news.js";

const R = [
  { tmdbId: 1, n: "Severance", s: 2, poster: "https://image.tmdb.org/t/p/w342/a.jpg", strm: { IL: ["Apple TV+"], US: [], UK: [] }, nx: { season: 3, episode: 1, date: "2027-03-14" } },
  { tmdbId: 3, n: "<b>Bear</b>", s: 3, poster: null, strm: { IL: ["Disney Plus"], US: [], UK: [] }, nx: null },
  { tmdbId: 4, n: "Succession", s: 4, strm: { IL: ["HBO Max"], US: [], UK: [] }, nx: null },
  { tmdbId: 5, n: "Gone", s: 2, nx: null },
];
const NEWS = [
  it({ id: "a", tmdbId: 3, kind: "stream_added", region: "IL", provider: "Disney Plus" }),
  it({ id: "b", tmdbId: 4, kind: "stream_removed", region: "UK", provider: "Sky Go", date: "2026-11-10" }),
  it({ id: "c", tmdbId: 1, kind: "announced", season: 3, airDate: "2027-03-14", date: "2026-11-06" }),
  it({ id: "d", tmdbId: 5, kind: "canceled", date: "2026-10-01" }),
  it({ id: "e", tmdbId: 999, kind: "ended", date: "2026-11-11" }),
];
const UP = [{ tmdbId: 1, season: 3, date: "2027-03-14" }];
const noBdi = (h) => h.replace(/<\/?bdi[^>]*>/g, "");

test("bellHTML: dot only with unseen items", () => {
  const off = bellHTML(0), on = bellHTML(2);
  assert.match(off, /href="#news"/);
  assert.doesNotMatch(off, /<i[ >]/);
  assert.match(on, /<i[ >]/);
  assert.match(on, /aria-label="[^"]*חדש[^"]*"/);
});

test("stripHTML", () => {
  assert.equal(stripHTML([], R, TODAY), "");
  const h = stripHTML([NEWS[0], { tmdbId: 1, season: 3, date: "2027-03-14" }], R, TODAY);
  assert.match(h, /מה חדש/);
  assert.match(h, /href="#news"/);
  assert.match(h, /data-a="detail" data-i="1"/, "row opens the card of S[1]");
  assert.match(h, /data-a="detail" data-i="0"/);
  assert.match(h, /Bear&lt;\/b&gt;/);
  assert.doesNotMatch(h, /<b>Bear/);
  assert.match(h, /class="flag">IL</);
  assert.match(noBdi(h), /Severance · עונה 3 ב-14 במרץ 2027/);
  assert.match(h, /<bdi>Apple TV\+<\/bdi>/, "Latin names isolated for RTL");
  assert.equal(stripHTML([NEWS[4]], R, TODAY), "", "series not in S -> nothing");
});

test("newsPageHTML: empty", () => {
  const h = newsPageHTML({ items: [], upcoming: [], filter: "הכל", today: TODAY }, R);
  assert.match(h, /אין חדשות כרגע/);
  assert.doesNotMatch(h, /עונות בדרך/);
  assert.match(newsPageHTML({ items: [NEWS[4]], upcoming: [], filter: "הכל", today: TODAY }, R), /אין חדשות כרגע/);
});

test("newsPageHTML: all, groups, upcoming, escaping, hidden series", () => {
  const h = newsPageHTML({ items: NEWS, upcoming: UP, filter: "הכל", today: TODAY }, R);
  for (const l of ["היום", "אתמול", "השבוע", "קודם", "עונות בדרך"]) assert.match(h, new RegExp(l));
  assert.ok(h.indexOf("עונות בדרך") < h.indexOf(">היום<"), "upcoming before the items");
  assert.deepEqual(FILTERS, ["הכל", "עונות חדשות", "סטרימינג", "הסתיימו"]);
  assert.match(h, /aria-pressed="true"[^>]*>הכל</);
  assert.match(h, /Bear&lt;\/b&gt;/);
  assert.doesNotMatch(h, /<b>Bear/);
  assert.match(h, /class="flag">UK</);
  assert.match(noBdi(h), /עדיין ב-HBO Max/);
  assert.doesNotMatch(h, /data-i="-1"/);
  assert.equal((h.match(/data-a="detail"/g) || []).length, 5, "4 visible items + 1 upcoming; tmdbId 999 dropped");
});

test("newsPageHTML: filters", () => {
  const st = newsPageHTML({ items: NEWS, upcoming: UP, filter: "סטרימינג", today: TODAY }, R);
  assert.doesNotMatch(st, /עונות בדרך/);
  assert.doesNotMatch(st, /k (season|cancel|end|prem)"/);
  assert.equal((st.match(/data-a="detail"/g) || []).length, 2);
  assert.match(st, /aria-pressed="true"[^>]*>סטרימינג</);
  const se = newsPageHTML({ items: NEWS, upcoming: UP, filter: "עונות חדשות", today: TODAY }, R);
  assert.match(se, /עונות בדרך/);
  assert.equal((se.match(/data-a="detail"/g) || []).length, 2, "announced + upcoming");
  const en = newsPageHTML({ items: NEWS, upcoming: UP, filter: "הסתיימו", today: TODAY }, R);
  assert.doesNotMatch(en, /עונות בדרך/);
  assert.match(en, /בוטלה/);
  assert.equal((en.match(/data-a="detail"/g) || []).length, 1);
  assert.match(newsPageHTML({ items: [NEWS[0]], upcoming: [], filter: "הסתיימו", today: TODAY }, R), /אין חדשות כרגע/);
});

test("newsPageHTML: upcoming capped at 10 then עוד N", () => {
  const S12 = Array.from({ length: 12 }, (_, k) => ({ tmdbId: 100 + k, n: "S" + k, nx: { season: 2, episode: 1, date: "2027-01-" + String(k + 10) } }));
  const up = upcomingSeasons(S12, TODAY);
  const h = newsPageHTML({ items: [], upcoming: up, filter: "הכל", today: TODAY }, S12);
  assert.equal((h.match(/data-a="detail"/g) || []).length, 10);
  assert.match(h, /עוד 2/);
  const all = newsPageHTML({ items: [], upcoming: up, filter: "הכל", today: TODAY, more: true }, S12);
  assert.equal((all.match(/data-a="detail"/g) || []).length, 12);
  assert.doesNotMatch(all, /עוד 2/);
});

test("no news.json (null -> []): strip and page still show upcoming seasons", () => {
  const strip = stripHTML(stripItems([], R, TODAY), R, TODAY);
  assert.match(noBdi(strip), /Severance · עונה 3 ב-14 במרץ 2027/);
  const page = newsPageHTML({ items: [], upcoming: upcomingSeasons(R, TODAY), filter: "הכל", today: TODAY }, R);
  assert.match(page, /עונות בדרך/);
  assert.doesNotMatch(page, /אין חדשות כרגע/);
});
