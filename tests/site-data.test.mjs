import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromData } from "../site/lib/data.js";
import { loadSeen, saveSeen } from "../site/lib/seen.js";

const S = fromData(JSON.parse(readFileSync("tests/fixtures/data-small.json", "utf8")));
const memStorage = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test("fromData builds the legacy series shape", () => {
  const bb = S[0], sev = S[1], ted = S[2];
  assert.equal(bb.id, 0); assert.equal(bb.n, "Breaking Bad"); assert.equal(bb.s, 5); assert.equal(bb.m, 47);
  assert.equal(bb.h, 3); assert.deepEqual(bb.g, ["crime", "thriller", "drama"]); assert.equal(bb.nyt, 1);
  assert.equal(bb.l, "מורה לכימיה");
  assert.equal(sev.l, "תקציר עברי");
  assert.equal(sev.airing, true);
  assert.equal(ted.nyt, null); assert.equal(ted.praise, "מבקרים אוהבים"); assert.deepEqual(ted.awards, ["אמי"]);
  assert.equal(bb.praise, null); assert.deepEqual(bb.awards, []); assert.equal(bb.castLabel, null);
});

test("legacy v1 seen indices migrate and unknown ones are dropped", () => {
  const st = memStorage();
  st.setItem("tvpick:v1", JSON.stringify({ seen: [1, 99] }));
  assert.deepEqual([...loadSeen(st, S)], [1]);
});

test("v2 stores tmdb ids and wins over v1", () => {
  const st = memStorage();
  saveSeen(st, new Set([1]), S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen, [95396]);
  st.setItem("tvpick:v1", JSON.stringify({ seen: [0] }));
  assert.deepEqual([...loadSeen(st, S)], [1]);
});

test("blocked storage gives an empty set and saving does not throw", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(loadSeen(blocked, S).size, 0);
  assert.doesNotThrow(() => saveSeen(blocked, new Set([0]), S));
});

test("fromData passes the series status through", () => {
  assert.equal(S[0].status, "ended");
  assert.equal(S[1].status, "airing");
  assert.equal(fromData({ series: [{ name: "X", lists: [] }] })[0].status, null);
});

test("seen marks for series not in today's data are kept when saving", () => {
  const st = memStorage();
  st.setItem("tvpick:v2", JSON.stringify({ seen: [95396, 777777] })); // 777777 rotated out of the pool
  const seen = loadSeen(st, S);
  assert.deepEqual([...seen], [1]);
  seen.add(0);
  saveSeen(st, seen, S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen.sort((a, b) => a - b), [1396, 95396, 777777]);
  seen.delete(1);
  saveSeen(st, seen, S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen.sort((a, b) => a - b), [1396, 777777]);
});

test("fromData passes the guessed providers through", () => {
  const S2 = fromData({ series: [{ name: "X", lists: [], providers: ["disney"], providersGuess: ["disney"] }, { name: "Y", lists: [] }] });
  assert.deepEqual(S2[0].providersGuess, ["disney"]);
  assert.deepEqual(S2[1].providersGuess, []);
});

test("fromData maps seasonEps to se", () => {
  const r = fromData({ series: [{ name: "X", lists: [], seasonEps: [7, 13] }, { name: "Y", lists: [] }] });
  assert.deepEqual(r[0].se, [7, 13]);
  assert.equal(r[1].se, null);
});

test("app.js loads the account code and views lazily (no static import)", () => {
  const src = readFileSync("site/app.js", "utf8");
  const statics = [...src.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)].map(m => m[1]);
  assert.ok(statics.length > 0, "found the static imports");
  assert.deepEqual(statics.filter(p => /account\/|views\//.test(p)), []);
  assert.doesNotMatch(src, /^\s*import\s*["'][^"']*(account\/|views\/)/m, "no side-effect-only import either");
  assert.match(src, /import\(\s*["']\.\/views\/mine\.js["']\s*\)/, "the tab loads views/mine.js on demand");
  assert.match(src, /import\(\s*["']\.\/views\/news\.js["']\s*\)/, "#news loads views/news.js on demand");
  assert.match(src, /import\(\s*["']\.\/lib\/account\/invite\.js["']\s*\)/, "the header invite loads lib/account/invite.js on demand");
});

test("fromData maps next and streams to nx and strm", () => {
  const nx = { season: 2, episode: 1, date: "2027-01-01" }, strm = { IL: ["Netflix"], US: [], UK: [] };
  const [a, b] = fromData({ series: [{ name: "X", lists: [], next: nx, streams: strm }, { name: "Y", lists: [] }] });
  assert.deepEqual(a.nx, nx); assert.deepEqual(a.strm, strm);
  assert.equal(b.nx, null); assert.equal(b.strm, null);
});

test("seen step: a skip button right under the subtitle, before the grid, plus the bottom button", () => {
  const src = readFileSync("site/app.js", "utf8");
  const m = /מה כבר ראיתם\?[\s\S]*?<\/div><\/div>`;/.exec(src);
  assert.ok(m, "found the seen step");
  const step = m[0];
  const sub = step.indexOf("אפשר לדלג.</p>"), skip = step.indexOf(">דילוג</button>"), grid = step.indexOf('<div class="grid">');
  assert.ok(sub > 0 && skip > sub && grid > skip, "skip sits between the subtitle and the grid");
  assert.match(step, /<button class="btn ghost[^"]*" data-a="next">דילוג<\/button>/);
  assert.equal((step.match(/data-a="next"/g) || []).length, 2, "the bottom button stays");
});

test("header: an invite button beside the bell; signed out shares the site, signed in goes through the account module", () => {
  const src = readFileSync("site/app.js", "utf8");
  const h = /function header\(\) \{[\s\S]*?<\/header>`/.exec(src);
  assert.ok(h, "found header()");
  assert.match(h[0], /\$\{inviteBtn\(\)\}\$\{bellNow\(\)\}/, "invite button right beside the bell");
  assert.match(src, /data-a="hinvite" aria-label="הזמנת חבר"/);
  const fn = /async function headerInvite\(\) \{[\s\S]*?\n\}\n/.exec(src)[0];
  assert.ok(fn.indexOf("hasSession()") < fn.indexOf("import("), "account code only behind the session check");
  assert.match(fn, /url: SITE_URL/); assert.match(fn, /AbortError/); assert.match(fn, /הקישור הועתק/); assert.match(fn, /ACCOUNT_DOWN/);
  assert.match(src, /SITE_URL = "https:\/\/achiyafried\.github\.io\/bingology\/"/);
});
