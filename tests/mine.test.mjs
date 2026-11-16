import { test } from "node:test";
import assert from "node:assert/strict";
import { mineHTML, sharedHTML, unavailableHTML, ACCOUNT_DOWN } from "../site/views/mine.js";

const P = f => `https://image.tmdb.org/t/p/w342/${f}.jpg`;
const S = [
  { id: 0, tmdbId: 95480, n: "Slow Horses", poster: P("slow"), se: [6, 6, 6, 6], e: 24, bs: 88, y: 2022 },
  { id: 1, tmdbId: 1438, n: "The Wire", poster: P("wire"), se: [13, 12, 12, 13, 10], e: 60, bs: 97, y: 2002 },
  { id: 2, tmdbId: 1396, n: "Breaking Bad", poster: P("bb"), se: [7, 13, 13, 13, 16], e: 62, bs: 95, y: 2008 },
  { id: 3, tmdbId: 4607, n: "Lost", poster: P("lost"), se: [25, 24, 23, 14, 17, 18], e: 121, bs: 70, y: 2004 },
].map(s => ({ creators: [], g: ["drama"], mo: [], h: 2, lang: "en", providers: [], imdb: 8, ...s })); // the fields "בשבילך" reads, as fromData gives them
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
  ], { seenSort: "date" }).split('class="stats"')[1]; // the lists only, not the "בשבילך" reasons above them
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

/* ── quick add (search at the top of the signed-in tab) ── */

const XSS = [...S, { id: 4, tmdbId: 777, n: `Bad <img src=x onerror=alert(1)> "Q"`, poster: "javascript:alert(1)", se: [8], e: 8, bs: 50, y: 2020 }];

test("quick add: a search field at the top for signed-in users, absent signed out and in the shared view", () => {
  const h = signedIn([]);
  assert.match(h, /הוספת סדרה/);
  assert.match(h, /<input[^>]*id="mine-q"[^>]*placeholder="חיפוש סדרה לפי שם"/);
  assert.ok(h.indexOf('id="mine-q"') < h.indexOf('class="stats"'), "the search sits above the lists");
  assert.doesNotMatch(mineHTML({ user: null, S }), /mine-q|הוספת סדרה/);
  assert.doesNotMatch(sharedHTML({ name: "דנה", entries: [] }, S), /mine-q|הוספת סדרה/);
});

test("quick add: empty query renders no results", () => {
  for (const q of [undefined, "", "   "]) {
    const h = signedIn([], { q });
    assert.doesNotMatch(h, /data-a="quick"/);
    assert.match(h, /<div class="qres" id="mine-qr"[^>]*><\/div>/);
  }
});

test("quick add: results with poster, name and seen / want / watching buttons; at most 8", () => {
  const h = signedIn([], { q: "slow" });
  assert.match(h, /<img src="https:\/\/image\.tmdb\.org\/t\/p\/w342\/slow\.jpg"/);
  assert.match(h, /Slow Horses/);
  for (const [v, t] of [["seen", "ראיתי"], ["want", "רוצה"], ["watching", "רואה עכשיו"]])
    assert.match(h, new RegExp(`data-a="quick" data-id="95480" data-v="${v}" aria-pressed="false">${t}<`));
  assert.doesNotMatch(h, /data-id="1438"/, "only matches");
  const many = Array.from({ length: 12 }, (_, k) => ({ id: k, tmdbId: 1000 + k, n: `Show ${k}`, poster: null, bs: k }));
  const hm = mineHTML({ user, profile, entries: new Map(), S: many, q: "show" });
  assert.equal(new Set([...hm.matchAll(/data-a="quick" data-id="(\d+)"/g)].map(m => m[1])).size, 8);
});

test("quick add: names escaped, unsafe posters dropped, the query value escaped", () => {
  const h = mineHTML({ user, profile, entries: new Map(), S: XSS, q: `bad "<` });
  const h2 = mineHTML({ user, profile, entries: new Map(), S: XSS, q: "bad" });
  assert.match(h, /value="bad &quot;&lt;"/);
  assert.doesNotMatch(h2, /<img src=x/);
  assert.match(h2, /Bad &lt;img src=x onerror=alert\(1\)&gt; &quot;Q&quot;/);
  assert.doesNotMatch(h2, /javascript:/);
});

test("quick add: the current status of an existing entry is pressed", () => {
  const h = signedIn([{ tmdb_id: 95480, status: "want", title: "Slow Horses", poster: null }], { q: "slow" });
  assert.match(h, /data-id="95480" data-v="want" aria-pressed="true"/);
  assert.match(h, /data-id="95480" data-v="seen" aria-pressed="false"/);
  assert.match(h, /data-id="95480" data-v="watching" aria-pressed="false"/);
});

test("quick add: no match says so", () => {
  assert.match(signedIn([], { q: "zzzz" }), /לא מצאנו/);
});

test("profile card: invite button with a circle, without one and while loading; absent signed out and shared", () => {
  const btn = /data-a="invite-quick"[^>]*>הזמנת חבר</;
  assert.match(mineHTML({ user, profile, entries: new Map(), S: S8, circle: null }), btn);
  assert.match(inCircle(), btn);
  assert.match(signedIn([]), /data-a="invite-quick" disabled>/, "disabled while the circle loads");
  assert.doesNotMatch(inCircle(), /invite-quick" disabled/);
  assert.doesNotMatch(mineHTML({ user: null, entries: new Map(), S: S8 }), /invite-quick/);
  assert.doesNotMatch(sharedHTML({ name: "דנה", entries: [] }, S), /invite-quick/);
});

/* ───────── for-you: "not for me" on the card ───────── */

test("series card: 'not for me' link only with no row or a want row; nope reads 'back to recommendations'", () => {
  const link = /<button class="linkbtn" data-a="cnope">([^<]*)<\/button>/;
  for (const entry of [null, { status: "want" }]) assert.equal(cardHTML({ entry, friends: [] }).match(link)?.[1], "לא בשבילי", JSON.stringify(entry));
  for (const status of ["seen", "watching", "dropped"]) assert.doesNotMatch(cardHTML({ entry: { status }, friends: [] }), /data-a="cnope"/, status);
  const h = cardHTML({ entry: { status: "nope" }, friends: [] });
  assert.equal(h.match(link)?.[1], "החזרה להמלצות");
  const st = [...h.matchAll(/data-a="cst" data-v="(\w+)" aria-pressed="(\w+)"/g)].map(m => m[1] + ":" + m[2]);
  assert.deepEqual(st, ["want:false", "watching:false", "seen:false", "dropped:false"]);
});

import { nopeAction } from "../site/views/card.js";

test("nopeAction: off only touches a row that is still nope; never overwrites or recreates", () => {
  for (const status of ["seen", "watching", "dropped", "want"]) {
    for (const prev of ["want", null, "seen"]) assert.equal(nopeAction({ status, rating: 9, note: "x" }, false, prev), null, `${status}/${prev}`);
  }
  assert.equal(nopeAction(null, false, "want"), null, "a missing row is not recreated");
  assert.equal(nopeAction(null, false, null), null);
  assert.equal(nopeAction({ status: "nope" }, false, "want"), "want");
  assert.equal(nopeAction({ status: "nope" }, false, null), "delete");
  assert.equal(nopeAction(null, true), "nope");
  assert.equal(nopeAction({ status: "want" }, true), "nope");
  for (const status of ["seen", "watching", "dropped", "nope"]) assert.equal(nopeAction({ status }, true), null, status);
});

import { nopeRefused } from "../site/views/card.js";
import { readFileSync } from "node:fs";

test("nopeRefused: a mark is refused only when my row is watching, seen or dropped", () => {
  assert.equal(nopeRefused(null), false, "no row (signed out or nothing there)");
  assert.equal(nopeRefused({ status: "nope" }), false);
  assert.equal(nopeRefused({ status: "want" }), false);
  for (const status of ["watching", "seen", "dropped"]) assert.equal(nopeRefused({ status, rating: 9 }), true, status);
});

test("writeNope resolves to {row, prev}: the row after the write and my status before it", () => {
  const src = readFileSync("site/views/card.js", "utf8");
  const fn = /async function nopeWrite\(s, on, prevStatus\) \{[\s\S]*?\n\}\n/.exec(src)[0];
  assert.match(fn, /const prev = e \? e\.status : null;/);
  assert.match(fn, /return \{ row: e, prev \};/, "nothing to do: the row as it is");
  assert.match(fn, /return \{ row: null, prev \};/, "deleted");
  assert.match(fn, /return \{ row: await store\.saveEntry\(/);
  assert.match(src, /st\.entry = \(await nopeWrite\(s, on, back\)\)\.row;/, "the card keeps using the row");
});

/* ── "בשבילך" and "לא בשבילי" ── */
import { fromData } from "../site/lib/data.js";
// data-small.json has 3 series; five copies of each give forYou enough candidates.
const BASE = fromData(JSON.parse(readFileSync("tests/fixtures/data-small.json", "utf8")));
const FS = BASE.flatMap((s, k) => Array.from({ length: 5 }, (_, c) => ({ ...s, tmdbId: s.tmdbId * 10 + c, n: `${s.n} ${c}`, poster: P(`p${k}${c}`) })));
const fyRow = (tmdb_id, status, rating = null, updated_at = "2026-01-01T00:00:00Z") => ({ tmdb_id, status, rating, updated_at });
const fy = (rows, extra = {}) => mineHTML({ user, profile, entries: new Map(rows.map(r => [r.tmdb_id, r])), S: FS, ...extra });
const fySection = h => (h.match(/<section class="foryou"[\s\S]*?<\/section>/) || [""])[0];
const tid = (k, c) => BASE[k].tmdbId * 10 + c;

test("for you, ready: heading, up to 8 items with want / not-for-me and the reason", () => {
  const h = fy([fyRow(tid(0, 0), "seen", 9), fyRow(tid(1, 0), "seen", 6), fyRow(tid(2, 0), "seen", 7)]);
  const sec = fySection(h);
  assert.match(sec, /<h3[^>]*>בשבילך<\/h3>/);
  const items = sec.match(/class="fyi"/g) || [];
  assert.ok(items.length >= 1 && items.length <= 8, `items: ${items.length}`);
  assert.equal((sec.match(/data-a="fy-want"/g) || []).length, items.length);
  assert.equal((sec.match(/data-a="fy-nope"/g) || []).length, items.length);
  assert.equal((sec.match(/כי אהבתם את <bdi>/g) || []).length, items.length);
  assert.match(sec, /כי אהבתם את <bdi>Breaking Bad 0<\/bdi>/);
  assert.match(sec, />\+ רוצה</);
  assert.match(sec, />לא בשבילי</);
  assert.match(sec, /data-a="detail" data-i="\d+"/);
  assert.ok(h.indexOf("בשבילך") < h.indexOf('class="stats"'), "above the stats");
});

test("for you is cached per rows + hidden marks: repaints give the same HTML, and a change still shows at once", () => {
  const rows = [fyRow(tid(0, 0), "seen", 9), fyRow(tid(1, 0), "seen", 6), fyRow(tid(2, 0), "seen", 7)];
  const a = fySection(fy(rows)), b = fySection(fy(rows.map(r => ({ ...r, updated_at: "2027-01-01T00:00:00Z" }))));
  assert.equal(a, b, "same key: identical output");
  const first = /data-a="fy-want" data-id="(\d+)"/.exec(a)[1];
  const hidden = new Set([FS.findIndex(s => s.tmdbId === +first)]);
  assert.doesNotMatch(fySection(fy(rows, { localSeenSet: hidden })), new RegExp(`data-id="${first}"`), "hidden mark changes the key");
  assert.doesNotMatch(fySection(fy([...rows, fyRow(+first, "want")])), new RegExp(`data-id="${first}"`), "new row changes the key");
  assert.equal(fySection(fy(rows)), a, "back to the first key");
});

test("mine.js: a status change off 'nope' and a load both clear stale local 'not for me' marks", () => {
  // save() and load() need the DOM and the account modules; the logic is in nope.js (staleNope, nopeCleared), tested there.
  const src = readFileSync("site/views/mine.js", "utf8");
  const save = /async function save\(id, patch\) \{[\s\S]*?\n\}\n/.exec(src)[0];
  assert.match(save, /if \(nopeCleared\(prev, row\) && CTX\.onNope\) CTX\.onNope\(id, false\)/);
  assert.match(src, /const entries = await store\.loadMine\(\);\n\s*if \(my !== seq\) return;\n\s*dropStaleNope\(entries\);/);
  assert.match(src, /for \(const i of staleNope\(S, nope, entries\)\) CTX\.onNope\(S\[i\]\.tmdbId, false\)/);
});

test("for you never offers a series with a row (seen included), or one marked seen on this device", () => {
  const rows = [fyRow(tid(0, 0), "seen", 9), fyRow(tid(1, 0), "seen", 6), fyRow(tid(2, 0), "seen", 7), fyRow(tid(0, 1), "want"), fyRow(tid(0, 2), "seen", null)];
  const local = new Set([FS.findIndex(s => s.tmdbId === tid(0, 3))]);
  const sec = fySection(fy(rows, { localSeenSet: local }));
  for (const x of [tid(0, 0), tid(0, 1), tid(0, 2), tid(0, 3)]) assert.doesNotMatch(sec, new RegExp(`data-id="${x}"`));
  assert.match(sec, new RegExp(`data-a="fy-nope" data-id="${tid(0, 4)}"`));
});

test("for you, two ratings: 'one more' line and unrated posters that open the card", () => {
  const rows = [fyRow(tid(0, 0), "seen", 9), fyRow(tid(1, 0), "seen", 6), fyRow(tid(2, 1), "seen", null)];
  const sec = fySection(fy(rows));
  assert.match(sec, /דרגו עוד סדרה אחת שראיתם ונתחיל להמליץ/);
  const k = FS.findIndex(s => s.tmdbId === tid(2, 1));
  assert.match(sec, new RegExp(`data-a="detail" data-i="${k}"`));
  assert.doesNotMatch(sec, /fy-want|fy-nope/);
  assert.doesNotMatch(sec, /בלשונית "הרשימה"/);
});

test("for you, nothing rated: 'N more' and a pointer to the list tab when there is nothing to rate", () => {
  const sec = fySection(fy([]));
  assert.match(sec, /דרגו עוד 3 סדרות שראיתם ונתחיל להמליץ/);
  assert.match(sec, /סמנו סדרות שראיתם בלשונית "הרשימה"/);
});

test("for you, ready but nothing left: the 'went through everything' line", () => {
  const rows = FS.map((s, k) => fyRow(s.tmdbId, k < 3 ? "seen" : "want", k === 0 ? 9 : k < 3 ? 6 : null));
  const sec = fySection(fy(rows));
  assert.match(sec, /עברתם על כל מה שמצאנו\. דרגו עוד סדרות שראיתם ונמצא עוד/);
  assert.doesNotMatch(sec, /fy-want/);
});

test("a nope row stays out of the lists and the stats, and sits in the folded 'not for me' list", () => {
  const rows = [fyRow(1396, "nope"), fyRow(1438, "want")];
  const closed = signedIn(rows);
  assert.match(closed, /data-a="nope-open"[^>]*>לא בשבילי \(1\)</);
  assert.doesNotMatch(closed, /nope-undo/);
  assert.match(closed, /<strong>1<\/strong><span>רוצה לראות/);
  assert.match(closed, /<strong>0<\/strong><span>ראיתי/);
  const open = signedIn(rows, { nopeOpen: true });
  assert.match(open, /data-a="nope-open" aria-expanded="true"/);
  assert.match(open, /data-a="nope-undo" data-id="1396"[^>]*>החזרה להמלצות</);
  const want = open.match(/<h3>רוצה לראות<\/h3>[\s\S]*?<\/div><\/div>/)[0];
  assert.doesNotMatch(want, /Breaking Bad/);
  assert.doesNotMatch(open, /<h3>ראיתי<\/h3>/);
});

test("only nope rows: the empty lists line, and the fold still shows", () => {
  const h = signedIn([fyRow(1396, "nope")]);
  assert.match(h, /עוד אין כאן סדרות/);
  assert.match(h, /לא בשבילי \(1\)/);
});

test("shared view never shows nope rows", () => {
  const h = sharedHTML({ name: "אחיה", entries: [fyRow(1396, "nope"), fyRow(1438, "seen", 9)] }, S);
  assert.doesNotMatch(h, /Breaking Bad/);
  assert.doesNotMatch(h, /לא בשבילי|nope/);
  assert.match(h, /The Wire/);
});

test("mine.js wires the for-you and not-for-me actions", () => {
  const src = readFileSync("site/views/mine.js", "utf8");
  assert.match(src, /case "fy-want":/);
  assert.match(src, /case "fy-nope":[\s\S]*?status: "nope"[\s\S]*?CTX\.onNope\(id, true\)/);
  assert.match(src, /case "nope-undo":[\s\S]*?store\.removeEntry\(id, \{ onlyStatus: "nope" \}\)[\s\S]*?V\.entries\.delete\(id\)[\s\S]*?CTX\.onNope\(id, false\)/);
  assert.match(readFileSync("site/app.js", "utf8"), /seenSet: \(\) => st\.seen/);
});
