import { test } from "node:test";
import assert from "node:assert/strict";
import { hubHTML, summaryHTML, guessHTML, oddHTML, chainHTML, groupsHTML, blurHTML } from "../site/views/games.js";
import { shareText } from "../site/lib/games/share.js";
import { esc } from "../site/lib/esc.js";

const IMG = "https://image.tmdb.org/t/p/w342/abc.jpg";
const card = (id, name, poster = IMG) => ({ id, name, poster });
const guess = { answer: card(1, "<b>Bold</b>"), clues: [{ kind: "genreYear", text: "דרמה · 2008" }, { kind: "langSeasons", text: "אנגלית · 5 עונות" }] };
const odd = { rounds: [0, 1, 2].map(r => ({ actor: { name: "Actor " + r, photo: IMG }, series: [card(10 + r, "A"), card(20 + r, "NoPoster", null), card(30 + r, "C"), card(40 + r, "D")], odd: 1 })) };
const chain = { from: 1, to: 3, shortest: 2, limit: 4, series: { 1: { name: "From", poster: IMG, cast: ["X"] }, 2: { name: "Mid", poster: null, cast: ["X", "Y"] }, 3: { name: "To", poster: IMG, cast: ["Y"] } } };
const items = Array.from({ length: 16 }, (_, i) => card(100 + i, "S" + i));
const groups = { items, groups: [0, 1, 2, 3].map(g => ({ kind: "year", label: "שנה " + g, level: g + 1, ids: items.slice(g * 4, g * 4 + 4).map(x => x.id) })) };
const blur = { actor: { name: "Patton Oswalt", photo: IMG }, count: 2, series: ["The Sandman", "BoJack Horseman"] };
const day = { date: "2026-11-13", v: 1, games: { guess, odd, chain, groups, blur } };

test("hubHTML: five cards in order with their states and labels", () => {
  const states = {
    guess: { guesses: [5, 1], done: true },
    odd: { picks: [1], done: false },
  };
  const h = hubHTML(day, states, 4);
  const order = [...h.matchAll(/data-g="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ["guess", "odd", "chain", "groups", "blur"]);
  const cardOf = id => h.slice(h.indexOf(`data-g="${id}"`), h.indexOf("</button>", h.indexOf(`data-g="${id}"`)));
  assert.match(cardOf("guess"), /סיים/);
  assert.match(cardOf("guess"), /2\/6/);
  assert.match(cardOf("odd"), /בתהליך/);
  assert.match(cardOf("chain"), /לשחק/);
  assert.match(h, /נחשו את הסדרה/);
  assert.match(h, /13\.11/);
  assert.match(h, /רצף 4/);
  assert.doesNotMatch(hubHTML(day, {}, 0), /רצף/);
});

test("hubHTML: a game missing from the day is not shown", () => {
  const h = hubHTML({ ...day, games: { guess, blur } }, {}, 0);
  assert.deepEqual([...h.matchAll(/data-g="(\w+)"/g)].map(m => m[1]), ["guess", "blur"]);
});

test("summaryHTML contains the share text and a share button", () => {
  const states = { guess: { guesses: [1], done: true }, blur: { guesses: ["x", "y", "x", "y", "x"], done: true } };
  const d = { ...day, games: { guess, blur } };
  const h = summaryHTML(d, states, 3);
  const text = shareText({ date: d.date, streak: 3, results: [{ id: "guess", label: "1/6" }, { id: "blur", label: "X/5" }] });
  assert.ok(h.includes(esc(text)), h);
  assert.match(h, /שיתוף/);
  assert.doesNotMatch(summaryHTML(d, states, 0, { practice: true }), /data-gshare/);
  assert.match(hubHTML(d, states, 3), /data-gshare/);
  assert.doesNotMatch(hubHTML(d, { guess: states.guess }, 3), /data-gshare/);
});

test("guessHTML escapes a series name containing <b>", () => {
  const done = guessHTML(guess, { guesses: [1], done: true }, { nameOf: () => "<b>Bold</b>", hasSeries: () => true });
  assert.ok(!done.includes("<b>Bold</b>"));
  assert.ok(done.includes("&lt;b&gt;Bold&lt;/b&gt;"));
  assert.match(done, /לפרטי הסדרה/);
  const playing = guessHTML(guess, { guesses: [7], done: false }, { nameOf: () => "<b>Wrong</b>", hasSeries: () => false });
  assert.ok(!playing.includes("<b>Wrong</b>"));
  assert.ok(playing.includes("&lt;b&gt;Wrong"));
  assert.match(playing, /אנגלית · 5 עונות/);
  assert.doesNotMatch(guessHTML(guess, { guesses: [1], done: true }, { hasSeries: () => false }), /לפרטי הסדרה/);
});

test("blurHTML: blur(24px) at the start, initials when safeImg rejects the photo", () => {
  const h = blurHTML(blur, { guesses: [], done: false }, {});
  assert.match(h, /filter: blur\(24px\)/);
  assert.match(h, /<img/);
  const bad = blurHTML({ ...blur, actor: { name: "Patton Oswalt", photo: "javascript:alert(1)" } }, { guesses: [], done: false }, {});
  assert.doesNotMatch(bad, /<img/);
  assert.doesNotMatch(bad, /javascript:/);
  assert.match(bad, /<span class="g-ini" aria-hidden="true">PO</);
  assert.match(h, /<span class="g-ini" aria-hidden="true" hidden>/, "initials stay hidden while the photo loads");
  const one = blurHTML(blur, { guesses: ["Nope"], done: false }, {});
  assert.match(one, /filter: blur\(16px\)/);
  assert.match(one, /2 סדרות במאגר/);
  assert.match(blurHTML(blur, { guesses: ["Patton Oswalt"], done: true }, { hasActor: () => true }), /לפרטי השחקן/);
});

test("a series card with poster: null renders the name without an <img>", () => {
  const h = oddHTML(odd, { picks: [], done: false }, {});
  const at = h.indexOf("NoPoster");
  assert.ok(at > 0);
  const btn = h.slice(h.lastIndexOf("<button", at), h.indexOf("</button>", at));
  assert.doesNotMatch(btn, /<img/);
  assert.match(h, /Actor 0/);
});

test("oddHTML reveals the impostor after a pick", () => {
  const h = oddHTML(odd, { picks: [0], done: false }, { reveal: 0 });
  assert.match(h, /data-gi="1"[^>]*class="[^"]*\bis-odd/);
  assert.match(h, /data-gi="0"[^>]*class="[^"]*\bis-wrong/);
  assert.match(h, /data-gnext/);
});

test("groupsHTML: solved items are not selectable", () => {
  const h = groupsHTML(groups, { solved: [0], mistakes: 1, tried: [], last: "wrong", done: false }, { sel: [] });
  for (const it of items.slice(0, 4)) assert.doesNotMatch(h, new RegExp(`data-gid="${it.id}"`));
  for (const it of items.slice(4)) assert.match(h, new RegExp(`data-gid="${it.id}"`));
  assert.match(h, /שנה 0/);
});

test("chainHTML shows the current series' cast", () => {
  const h = chainHTML(chain, { path: [1], via: [], steps: 0, done: false }, {});
  assert.match(h, /From/);
  assert.match(h, /data-gact="X"/);
  const pick = chainHTML(chain, { path: [1], via: [], steps: 0, done: false }, { actor: "X" });
  assert.match(pick, /data-gto="2"/);
});

test("chainRoute finds the shortest route through shared actors", async () => {
  const { chainRoute } = await import("../site/views/games.js");
  assert.deepEqual(chainRoute(chain), [{ id: "1", via: null }, { id: "2", via: "X" }, { id: "3", via: "Y" }]);
  assert.equal(chainRoute({ ...chain, series: { ...chain.series, 3: { name: "To", poster: null, cast: ["Z"] } } }), null);
});
