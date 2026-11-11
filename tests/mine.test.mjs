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

/* ───────── Task 8: circle, feed, joint pick, card additions ───────── */
import { BAD_INVITE, ago } from "../site/views/mine.js";
import { cardHTML } from "../site/views/card.js";
import { inviteUrl } from "../site/lib/account/circle.js";

const S8 = [...S, { id: 4, tmdbId: 136315, n: "The Bear", poster: P("bear"), se: [8, 10, 10], e: 28, bs: 91, y: 2022 }];
const NOW = Date.parse("2026-11-11T12:00:00Z");
const members = [{ id: "u1", name: "אחיה" }, { id: "u2", name: "דנה" }];
const circle = { id: "c1", invite_code: "AbCdEf2345", members };
const text = h => h.replace(/<[^>]+>/g, "");
const inCircle = (extra = {}) => mineHTML({ user, profile, entries: new Map(), S: S8, circle, now: NOW, ...extra });

test("no circle: open one or use an invite link", () => {
  const h = mineHTML({ user, profile, entries: new Map(), S: S8, circle: null });
  assert.match(h, /data-a="circle-create"[^>]*>פתחו מעגל</);
  assert.match(h, /data-a="circle-have"[^>]*>יש לי קישור הזמנה</);
  assert.doesNotMatch(signedIn([]), /פתחו מעגל/, "nothing while the circle is still loading");
});

test("feed: a rating line with relative time; only the 20 newest of 25", () => {
  const older = Array.from({ length: 24 }, (_, k) => ({ id: k + 2, user_id: "u2", kind: "dropped", tmdb_id: 4607, season: k + 1, created_at: new Date(NOW - (k + 3) * 3600e3).toISOString() }));
  const feed = [...older.slice(12), { id: 1, user_id: "u2", kind: "rated", rating: 9, tmdb_id: 136315, created_at: new Date(NOW - 2 * 3600e3).toISOString() }, ...older.slice(0, 12)];
  const h = inCircle({ feed });
  const t = text(h);
  assert.match(t, /דנה: ציון 9 ל-The Bear/);
  assert.match(t, /לפני שעתיים/);
  assert.equal((h.match(/class="it fe"/g) || []).length, 20);
  assert.ok(t.indexOf("ציון 9") < t.indexOf("בעונה 1"), "newest first");
  assert.match(t, /בעונה 19/);
  assert.doesNotMatch(t, /בעונה 2[0-4]/, "the 5 oldest are not shown");
});

test("relative times", () => {
  const at = ms => new Date(NOW - ms).toISOString();
  assert.equal(ago(at(20e3), NOW), "עכשיו");
  assert.equal(ago(at(60e3), NOW), "לפני דקה");
  assert.equal(ago(at(5 * 60e3), NOW), "לפני 5 דקות");
  assert.equal(ago(at(3600e3), NOW), "לפני שעה");
  assert.equal(ago(at(2 * 3600e3), NOW), "לפני שעתיים");
  assert.equal(ago(at(5 * 3600e3), NOW), "לפני 5 שעות");
  assert.equal(ago(at(30 * 3600e3), NOW), "אתמול");
  assert.equal(ago(at(3 * 86400e3), NOW), "לפני 3 ימים");
});

test("joint pick: both names, yalla and another suggestion", () => {
  const h = inCircle({ pick: { tmdbId: 136315, mode: "shared", partner: "u2" } });
  assert.match(h, /class="joint"/);
  assert.match(text(h), /בינג׳ משותף · אחיה ודנה/);
  assert.match(text(h), /The Bear/);
  assert.match(h, /data-a="pick-yes" data-id="136315"[^>]*>יאללה</);
  assert.match(h, /data-a="pick-skip" data-id="136315"[^>]*>הצעה אחרת</);
});

test("joint pick fallback: header says nobody in the circle has seen it", () => {
  const h = inCircle({ pick: { tmdbId: 136315, mode: "fallback", partner: "u2" } });
  assert.match(text(h.slice(h.indexOf('class="joint"'))), /^[^>]*>?אף אחד במעגל עוד לא ראה/);
});

test("circle: faces for every member, invite and leave; names escaped", () => {
  const evil = { id: "u3", name: "<img src=x>" };
  const h = inCircle({ circle: { ...circle, members: [...members, evil] }, feed: [{ id: 1, user_id: "u3", kind: "wanted", tmdb_id: 1438, created_at: new Date(NOW).toISOString() }] });
  assert.equal((h.match(/class="face f\d"/g) || []).length, 3 + 1, "3 faces + 1 in the feed");
  assert.doesNotMatch(h, /<img src=x>/);
  assert.match(text(h), /&lt;img src=x&gt;: רוצה לראות את/);
  assert.match(h, /data-a="circle-invite"[^>]*>הזמנת חבר למעגל</);
  assert.match(h, /data-a="circle-leave"/);
});

test("alone in a circle: no joint pick, an invite prompt", () => {
  const h = inCircle({ circle: { ...circle, members: [members[0]] } });
  assert.doesNotMatch(h, /class="joint"/);
  assert.match(h, /data-a="circle-invite"/);
});

test("invite: bad code shows the verbatim copy; in another circle asks first", () => {
  assert.equal(BAD_INVITE, "הקישור לא תקין או שפג תוקפו");
  assert.match(inCircle({ notice: BAD_INVITE }), /הקישור לא תקין או שפג תוקפו/);
  const h = inCircle({ confirm: { kind: "join", names: ["דנה", "יואב"] } });
  assert.match(text(h), /אתם כבר במעגל עם דנה ויואב\. לעבור\?/);
  assert.match(h, /data-a="confirm-yes"/);
  assert.match(h, /data-a="confirm-no"/);
  const c = inCircle({ confirm: { kind: "create", names: ["דנה", "יואב", "מיכל"] } });
  assert.match(text(c), /אתם כבר במעגל עם דנה, יואב ומיכל\. לפתוח מעגל חדש\?/);
});

test("inviteUrl builds a #join= link", () => {
  assert.equal(inviteUrl("AbC23", "https://x.example/bingology/"), "https://x.example/bingology/#join=AbC23");
});

test("series card (signed in): 4 statuses, rating 1-10 when seen, friends chips", () => {
  const h = cardHTML({ entry: { status: "seen", rating: 9 }, friends: [
    { id: "u2", name: "דנה", status: "seen", rating: 8 },
    { id: "u3", name: "יואב", status: "want" },
    { id: "u4", name: "<b>x</b>", status: "watching" },
  ] });
  const st = [...h.matchAll(/data-a="cst" data-v="(\w+)" aria-pressed="(\w+)"/g)].map(m => m[1] + ":" + m[2]);
  assert.deepEqual(st, ["want:false", "watching:false", "seen:true", "dropped:false"]);
  assert.equal((h.match(/data-a="crate"/g) || []).length, 10);
  assert.match(h, /data-a="crate" data-v="9" aria-pressed="true"/);
  assert.match(text(h), /דנה 8/);
  assert.match(text(h), /יואב רוצה לראות/);
  assert.doesNotMatch(h, /<b>x<\/b>/);
});

test("series card: no rating row before seen; no friends block when none", () => {
  const h = cardHTML({ entry: { status: "want" }, friends: [] });
  assert.doesNotMatch(h, /data-a="crate"/);
  assert.doesNotMatch(h, /class="friends"/);
  assert.match(cardHTML({ entry: null, friends: [] }), /data-a="cst" data-v="want" aria-pressed="false"/);
});

/* ───────── Task 8 fix round 1 ───────── */
import { partnerYes, readJoin, JOIN_TTL } from "../site/views/mine.js";

test("card error state falls back to the local seen toggle", () => {
  const off = cardHTML({ err: true, seen: false });
  assert.match(off, /data-a="dseen"[^>]*>סימון כנצפתה</);
  assert.match(cardHTML({ err: true, seen: true }), /data-a="dseen"[^>]*>עוד לא ראיתי</);
  assert.doesNotMatch(off, /data-a="cst"/);
  assert.match(cardHTML({ local: true, seen: false }), /data-a="dseen"/, "no session after all (stale): local toggle too");
});

test("partner-yes pick only while the partner is still watching it", () => {
  const votes = [{ tmdb_id: 136315, user_id: "u2", vote: "yes" }];
  const base = { votes, me: "u1", partner: "u2", skipped: new Set(), has: () => true };
  const lists = st => new Map([["u1", new Map()], ["u2", new Map([[136315, st]])]]);
  assert.equal(partnerYes({ ...base, lists: lists("watching") }), 136315);
  assert.equal(partnerYes({ ...base, lists: lists("seen") }), null);
  assert.equal(partnerYes({ ...base, lists: lists("dropped") }), null);
  assert.equal(partnerYes({ ...base, lists: new Map([["u1", new Map([[136315, "watching"]])], ["u2", new Map([[136315, "watching"]])]]) }), null, "I already started it");
  assert.equal(partnerYes({ ...base, lists: lists("watching"), skipped: new Set([136315]) }), null);
});

test("pending invite expires after 7 days", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  assert.equal(JOIN_TTL, 7 * 86400e3);
  assert.equal(readJoin(JSON.stringify({ code: "AbC234", at: now - 86400e3 }), now), "AbC234");
  assert.equal(readJoin(JSON.stringify({ code: "AbC234", at: now - 8 * 86400e3 }), now), null);
  assert.equal(readJoin("AbC234", now), null, "old format without a timestamp is dropped");
  assert.equal(readJoin(null, now), null);
});

test("ago: two days is 'לפני יומיים'", () => {
  assert.equal(ago(new Date(NOW - 2 * 86400e3 - 3600e3).toISOString(), NOW), "לפני יומיים");
  assert.equal(ago(new Date(NOW - 2 * 3600e3).toISOString(), NOW), "לפני שעתיים");
});
