import { test } from "node:test";
import assert from "node:assert/strict";
import { mineHTML, sharedHTML, unavailableHTML, ACCOUNT_DOWN } from "../site/views/mine.js";

const P = f => `https://image.tmdb.org/t/p/w342/${f}.jpg`;
const S = [
  { id: 0, tmdbId: 95480, n: "Slow Horses", poster: P("slow"), se: [6, 6, 6, 6], e: 24, bs: 88, y: 2022 },
  { id: 1, tmdbId: 1438, n: "The Wire", poster: P("wire"), se: [13, 12, 12, 13, 10], e: 60, bs: 97, y: 2002 },
  { id: 2, tmdbId: 1396, n: "Breaking Bad", poster: P("bb"), se: [7, 13, 13, 13, 16], e: 62, bs: 95, y: 2008 },
  { id: 3, tmdbId: 4607, n: "Lost", poster: P("lost"), se: [25, 24, 23, 14, 17, 18], e: 121, bs: 70, y: 2004 },
];
const user = { id: "u1", email: "a@example.com", name: "אחיה" };
const profile = { id: "u1", name: "אחיה", circle_id: null, share_slug: null };
const signedIn = (rows, extra = {}) => mineHTML({ user, profile, entries: new Map(rows.map(r => [r.tmdb_id, r])), S, ...extra });

test("signed out: Google sign-in and how many local marks move to the account", () => {
  const h = mineHTML({ user: null, S, localSeen: 3 });
  assert.match(h, /כניסה עם Google/);
  assert.match(h, /3 סימוני "ראיתי"[^<]*יעברו לחשבון/);
  assert.match(h, /data-a="signin-google"/);
});

test("signed out with no local marks: no migration line", () => {
  assert.doesNotMatch(mineHTML({ user: null, S, localSeen: 0 }), /יעברו לחשבון/);
});

test("watching: season/episode, evenings left at pace 2, progress bar and +1 button", () => {
  const h = signedIn([{ tmdb_id: 95480, status: "watching", season: 3, episode: 4, title: "Slow Horses", poster: P("slow") }]);
  assert.match(h, /עונה 3 · פרק 4/);
  assert.match(h, /עוד 4 ערבים/); // 16/24 watched, 8 left, 2 per evening (ruling R3)
  assert.match(h, /style="width:67%"/);
  assert.match(h, /data-a="plus" data-id="95480"/);
  assert.match(h, /\+1 פרק/);
});

test("watching row at the final-episode prompt asks for a rating instead of +1", () => {
  const h = signedIn([{ tmdb_id: 95480, status: "watching", season: 4, episode: 6, title: "Slow Horses", poster: null }], { prompt: 95480 });
  assert.match(h, /סיימת\? תנו ציון/);
  assert.match(h, /data-a="rate" data-id="95480" data-v="10"/);
  assert.doesNotMatch(h, /data-a="plus"/);
});

test("stats count seen / want / watching", () => {
  const h = signedIn([
    { tmdb_id: 1438, status: "seen", rating: 10, title: "The Wire", poster: null },
    { tmdb_id: 1396, status: "seen", rating: 9, title: "Breaking Bad", poster: null },
    { tmdb_id: 4607, status: "dropped", season: 4, title: "Lost", poster: null },
    { tmdb_id: 95480, status: "want", title: "Slow Horses", poster: null },
  ]);
  const nums = [...h.matchAll(/<div class="stat"><strong>(\d+)<\/strong><span>([^<]+)<\/span>/g)].map(m => [m[2], +m[1]]);
  assert.deepEqual(nums, [["ראיתי", 2], ["רוצה לראות", 1], ["עכשיו", 0]]);
});

test("seen list is sorted by rating, dropped shows the season and a dash", () => {
  const h = signedIn([
    { tmdb_id: 1396, status: "seen", rating: 9, title: "Breaking Bad", poster: null, note: "<b>wow</b>" },
    { tmdb_id: 4607, status: "dropped", season: 4, episode: 2, rating: null, title: "Lost", poster: null },
    { tmdb_id: 1438, status: "seen", rating: 10, title: "The Wire", poster: null },
  ]);
  const order = ["The Wire", "Breaking Bad", "Lost"].map(t => h.indexOf(t));
  assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2], "sorted by rating desc");
  assert.match(h, /נטשתי בעונה 4/);
  assert.match(h, /<span class="score none"[^>]*>—<\/span>/);
  assert.match(h, /&lt;b&gt;wow&lt;\/b&gt;/, "notes are escaped");
});

test("want list shows the binge score and opens the series card", () => {
  const h = signedIn([{ tmdb_id: 1438, status: "want", title: "The Wire", poster: null }]);
  assert.match(h, /בינג׳ 97/);
  assert.match(h, /data-a="detail" data-i="1"/);
});

test("entry not in today's data: stored title/poster, no card link, no binge score", () => {
  const h = signedIn([{ tmdb_id: 999999, status: "want", title: "Gone <Show>", poster: P("gone") }]);
  assert.match(h, /Gone &lt;Show&gt;/);
  assert.match(h, new RegExp(P("gone").replace(/[./]/g, "\\$&")));
  assert.doesNotMatch(h, /data-a="detail"/);
  assert.doesNotMatch(h, /בינג׳ \d/);
});

test("unsafe stored poster URLs are not rendered", () => {
  const h = signedIn([{ tmdb_id: 999999, status: "want", title: "X", poster: "javascript:alert(1)" }]);
  assert.doesNotMatch(h, /javascript:/);
});

test("share: off shows a share button, on shows copy and turn-off", () => {
  assert.match(signedIn([]), /data-a="share" data-v="on"/);
  const h = mineHTML({ user, profile: { ...profile, share_slug: "abc" }, entries: new Map(), S });
  assert.match(h, /data-a="share" data-v="copy"/);
  assert.match(h, /data-a="share" data-v="off"/);
});

test("account error renders the verbatim unavailable copy with a retry button", () => {
  const h = mineHTML({ error: true, S });
  assert.equal(h, unavailableHTML());
  assert.ok(h.includes(ACCOUNT_DOWN));
  assert.equal(ACCOUNT_DOWN, "לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע");
  assert.match(h, /class="empty"/);
  assert.match(h, /data-a="mretry"/);
});

test("sharedHTML: read only — no buttons, no circle", () => {
  const h = sharedHTML({ name: "דנה", entries: [
    { tmdb_id: 95480, status: "watching", season: 1, episode: 2, title: "Slow Horses", poster: null },
    { tmdb_id: 1438, status: "seen", rating: 8, title: "The Wire", poster: null },
    { tmdb_id: 1396, status: "want", title: "Breaking Bad", poster: null },
  ] }, S);
  assert.match(h, /הבינג׳ים של דנה/);
  assert.match(h, /The Wire/);
  assert.doesNotMatch(h, /<button/);
  assert.doesNotMatch(h, /data-a=/);
  assert.doesNotMatch(h, /המעגל|במעגל/);
});

test("sharedHTML with no profile says the link is not active", () => {
  const h = sharedHTML(null, S);
  assert.match(h, /class="empty"/);
  assert.doesNotMatch(h, /<button/);
});

test("first sign-in: name step prefilled (escaped), 1-40 chars, save button", () => {
  const h = mineHTML({ user, profile: { ...profile, name: 'Dan "<x>"' }, created: true, entries: new Map(), S });
  assert.match(h, /id="mine-name"/);
  assert.match(h, /value="Dan &quot;&lt;x&gt;&quot;"/);
  assert.match(h, /maxlength="40"/);
  assert.match(h, /required/);
  assert.match(h, /data-a="name-save"[^>]*>שמירה</);
  assert.doesNotMatch(h, /<x>/);
});

test("no name step for a returning user; the card offers 'שינוי שם' which opens it", () => {
  const h = signedIn([]);
  assert.doesNotMatch(h, /id="mine-name"/);
  assert.match(h, /data-a="rename"[^>]*>שינוי שם</);
  assert.match(mineHTML({ user, profile, naming: true, entries: new Map(), S }), /id="mine-name"/);
});

test("seen rows without finished_on show no year", () => {
  const h = signedIn([
    { tmdb_id: 1438, status: "seen", rating: 10, finished_on: null, title: "The Wire", poster: null, updated_at: "2026-11-11T10:00:00Z" },
    { tmdb_id: 1396, status: "seen", rating: 9, finished_on: "2019-03-02", title: "Breaking Bad", poster: null },
  ]);
  assert.doesNotMatch(h, /2026/);
  assert.match(h, /<small>2019<\/small>/);
});

test("date sort: newest finished first, unknown dates last", () => {
  const h = signedIn([
    { tmdb_id: 1438, status: "seen", rating: 10, finished_on: null, title: "The Wire", poster: null, updated_at: "2026-11-11T10:00:00Z" },
    { tmdb_id: 1396, status: "seen", rating: 9, finished_on: "2019-03-02", title: "Breaking Bad", poster: null },
    { tmdb_id: 4607, status: "seen", rating: 5, finished_on: "2023-01-01", title: "Lost", poster: null },
  ], { seenSort: "date" });
  const order = ["Lost", "Breaking Bad", "The Wire"].map(t => h.indexOf(t));
  assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
});
