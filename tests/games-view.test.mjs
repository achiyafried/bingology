import { test } from "node:test";
import assert from "node:assert/strict";
import { hubHTML, summaryHTML, guessHTML, oddHTML, chainHTML, groupsHTML, blurHTML, riddleHTML, howHTML, chainRoute } from "../site/views/games.js";
import { shareText } from "../site/lib/games/share.js";
import { esc } from "../site/lib/esc.js";

const IMG = "https://image.tmdb.org/t/p/w342/abc.jpg";
const card = (id, name, poster = IMG) => ({ id, name, poster });
const guess = { answer: card(1, "<b>Bold</b>"), clues: [{ kind: "genreYear", text: "דרמה · 2008" }, { kind: "langSeasons", text: "אנגלית · 5 עונות" }] };
const odd = { rounds: [0, 1, 2].map(r => ({ actor: { name: "Actor " + r, photo: IMG }, series: [card(10 + r, "A"), card(20 + r, "NoPoster", null), card(30 + r, "C"), card(40 + r, "D")], odd: 1 })) };
const chain = { from: 1, to: 3, shortest: 2, limit: 4, series: { 1: { name: "From", poster: IMG, cast: ["X"] }, 2: { name: "Mid", poster: null, cast: ["X", "Y"] }, 3: { name: "To", poster: IMG, cast: ["Y"] } } };
const items = Array.from({ length: 16 }, (_, i) => card(100 + i, "S" + i));
const groups = { items, groups: [0, 1, 2, 3].map(g => ({ kind: "decade", label: "שנה " + g, level: g + 1, ids: items.slice(g * 4, g * 4 + 4).map(x => x.id) })) };
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
  const [head, line, url] = text.split("\n");
  assert.ok(h.includes(esc(head + "\n" + line)), h);
  assert.ok(!h.includes(url), "the link goes into the shared text, not the box on screen");
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

test("howHTML: one muted line per game; chain names the start and goal, escaped", () => {
  assert.equal(howHTML("guess", guess), `<p class="g-how">נחשו את הסדרה. כל טעות חושפת רמז נוסף. יש 6 ניסיונות.</p>`);
  assert.match(howHTML("odd", odd), /שלוש מהסדרות הן של השחקן\/ית, אחת מתחזה\. מצאו אותה\./);
  assert.match(howHTML("groups", groups), /שבצו את 16 הסדרות לארבע הקבוצות שלמעלה\. בחרו 4 ולחצו שליחה\. מותר לטעות 4 פעמים\./);
  assert.match(howHTML("blur", blur), /מי השחקן\/ית\? כל טעות מחדדת את התמונה וחושפת רמז\. יש 5 ניסיונות\./);
  const c = howHTML("chain", { ...chain, series: { ...chain.series, 1: { ...chain.series[1], name: "<i>From</i>" } } });
  assert.match(c, /^<p class="g-how">המטרה: להגיע מ-<bdi>&lt;i&gt;From&lt;\/i&gt;<\/bdi> ל-<bdi>To<\/bdi>\. בכל צעד בוחרים שחקן\/ית מהסדרה שאתם בה, ועוברים לסדרה אחרת שהוא\/היא שיחקו בה\.<\/p>$/);
  for (const id of ["guess", "odd", "chain", "groups", "blur"]) assert.match(howHTML(id, { guess, odd, chain, groups, blur }[id]), /^<p class="g-how">/);
});

// 1 -X- 2 -Y- 3 is the shortest route; 1 -Z- 4 -W- 5 -V- 3 is longer. D (in 1 only) has nowhere to go.
const chain2 = { from: 1, to: 3, shortest: 2, limit: 4, series: {
  1: { name: "From", poster: IMG, cast: ["D", "Z", "X"] },
  2: { name: "Mid", poster: null, cast: ["X", "Y"] },
  3: { name: "To", poster: IMG, cast: ["Y", "V"] },
  4: { name: "Side", poster: null, cast: ["Z", "W"] },
  5: { name: "Far", poster: null, cast: ["W", "V"] },
} };
const s0 = { path: [1], via: [], steps: 0, done: false };

test("chainHTML: start and goal labels, start first (right in RTL), counter", () => {
  const h = chainHTML(chain2, s0, {});
  const a = h.indexOf("התחלה"), b = h.indexOf("יעד");
  assert.ok(a > 0 && b > a);
  assert.ok(h.indexOf("From") > a && h.indexOf("From") < b);
  assert.match(h, /נשארו 4 צעדים · אפשר ב-2/);
  assert.doesNotMatch(h, /מתוך/);
  assert.match(chainHTML(chain2, { path: [1, 4], via: ["Z"], steps: 1, done: false }, {}), /נשארו 3 צעדים · אפשר ב-2/);
});

test("chainHTML: actors with somewhere to go first, dead ends last and disabled", () => {
  const h = chainHTML(chain2, s0, {});
  const order = [...h.matchAll(/data-gact="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ["Z", "X", "D"]);
  assert.match(h, /data-gact="D" disabled/);
  assert.doesNotMatch(h, /data-gact="[XZ]" disabled/);
});

test("chainHTML: hint button highlights the actor on a shortest route from the current series", () => {
  const h = chainHTML(chain2, s0, {});
  assert.match(h, /data-ghint[^>]*>רמז</);
  assert.doesNotMatch(h, /is-hint/);
  const hinted = chainHTML(chain2, { ...s0, hinted: true }, { hint: "1" });
  assert.match(hinted, /class="chip is-hint" data-gact="X"/);
  assert.equal((hinted.match(/is-hint/g) || []).length, 1);
  assert.match(hinted, /data-ghint disabled/);
  // From series 4 the shortest way on is W (4 -W- 5 -V- 3).
  const at4 = chainHTML(chain2, { path: [1, 4], via: ["Z"], steps: 1, done: false, hinted: true }, { hint: "4" });
  assert.match(at4, /class="chip is-hint" data-gact="W"/);
  // A hint shown for another series is not shown here.
  assert.doesNotMatch(chainHTML(chain2, { path: [1, 4], via: ["Z"], steps: 1, done: false, hinted: true }, { hint: "1" }), /is-hint/);
  // Choosing the hinted actor highlights the series on the route.
  const pick = chainHTML(chain2, { ...s0, hinted: true }, { hint: "1", actor: "X" });
  assert.match(pick, /data-gto="2" class="[^"]*\bis-hint/);
});

test("chainRoute from a given series", () => {
  assert.deepEqual(chainRoute(chain2, 4).map(r => r.id), ["4", "5", "3"]);
  assert.deepEqual(chainRoute(chain2).map(r => r.id), ["1", "2", "3"]);
});

test("chain: a hinted win at the shortest length reads as success, not perfect", () => {
  const h = chainHTML(chain2, { path: [1, 2, 3], via: ["X", "Y"], steps: 2, done: true, hinted: true }, {});
  assert.match(h, /הגעתם!/);
  assert.doesNotMatch(h, /מושלם/);
});

test("groupsHTML: the four labels are listed from the start; solved ones are coloured and checked", () => {
  const h = groupsHTML(groups, { solved: [], mistakes: 0, tried: [], last: null, done: false }, { sel: [] });
  const list = h.slice(h.indexOf('<ul class="g-labels"'), h.indexOf("</ul>") + 5);
  for (const g of groups.groups) assert.ok(list.includes(esc(g.label)), g.label);
  assert.doesNotMatch(list, /lv\d/);
  assert.ok(h.indexOf("g-labels") < h.indexOf("g-grid"));
  const one = groupsHTML(groups, { solved: [2], mistakes: 0, tried: [], last: "ok", done: false }, { sel: [] });
  const l2 = one.slice(one.indexOf('<ul class="g-labels"'), one.indexOf("</ul>") + 5);
  assert.match(l2, /<li class="lv3 ok">✓ <bdi>שנה 2<\/bdi><\/li>/);
  assert.equal((l2.match(/lv\d/g) || []).length, 1);
  const lbl = groupsHTML({ ...groups, groups: groups.groups.map((g, i) => (i ? g : { ...g, label: "<s>x</s>" })) }, { solved: [], mistakes: 0, tried: [], last: null, done: false }, {});
  assert.ok(!lbl.includes("<s>x</s>"));
});

const riddle = { clue: "הוא נשאר בתוך הים אז הם שרדו", answer: "שובר שורות", words: [4, 5], tmdbId: 1396, explain: "<i>הסבר</i>" };
const rs = (o = {}) => ({ letters: [], hints: 0, tries: 0, done: false, gaveUp: false, ...o });

test("riddleHTML: clue, one box per letter grouped by word, hidden input for the keyboard", () => {
  const h = riddleHTML(riddle, rs({ letters: ["ש", "ו"] }));
  assert.ok(h.includes("הוא נשאר בתוך הים אז הם שרדו"));
  const words = h.split('class="g-word"').slice(1);
  assert.equal(words.length, 2);
  assert.deepEqual(words.map(w => (w.match(/class="g-box/g) || []).length), [4, 5]);
  assert.match(h, /<input id="gr"[^>]*inputmode="text"[^>]*autocomplete="off"/);
  assert.match(h, /aria-label="9 אותיות, הוזנו: שו"/);
});

test("riddleHTML: hinted boxes carry .hint; check is disabled until all boxes are full", () => {
  const h = riddleHTML(riddle, rs({ letters: ["ש", "ו", "ב"], hints: 2 }));
  assert.equal((h.match(/g-box hint/g) || []).length, 2);
  assert.match(h, /data-rcheck disabled/);
  const full = riddleHTML(riddle, rs({ letters: [..."שוברשורות"] }));
  assert.doesNotMatch(full, /data-rcheck disabled/);
});

test("riddleHTML: last='wrong' shows the retry message and shakes", () => {
  const h = riddleHTML(riddle, rs({ letters: [..."שוברשורזת"], tries: 1, last: "wrong" }));
  assert.ok(h.includes("לא בדיוק, נסו שוב"));
  assert.match(h, /g-boxes shake/);
  assert.doesNotMatch(riddleHTML(riddle, rs()), /shake|לא בדיוק/);
});

test("riddleHTML: reveal asks to confirm first", () => {
  assert.match(riddleHTML(riddle, rs()), /data-rreveal>גילוי התשובה</);
  assert.match(riddleHTML(riddle, rs(), { sure: true }), /data-rreveal>בטוחים\? לגלות</);
});

test("riddleHTML done: answer, escaped explain, series button only when the series exists", () => {
  const h = riddleHTML(riddle, rs({ letters: [..."שוברשורות"], done: true }), { hasSeries: id => id === 1396 });
  assert.ok(h.includes("שובר שורות"));
  assert.ok(h.includes(esc("<i>הסבר</i>")));
  assert.match(h, /data-gs="1396"/);
  assert.doesNotMatch(h, /<input id="gr"/);
  const gone = riddleHTML(riddle, rs({ done: true, gaveUp: true }), { hasSeries: () => false });
  assert.doesNotMatch(gone, /data-gs=/);
  assert.ok(gone.includes("התשובה"));
});

test("howHTML explains the riddle", () => {
  assert.ok(howHTML("riddle", riddle).includes("התשובה היא שם של סדרה, כתוב בעברית"));
});

test("riddleHTML done: the boxes spell the answer with its final letters", () => {
  const p = { clue: "c", answer: "הנותרים", words: [7], tmdbId: 54344 };
  const boxes = h => [...h.matchAll(/class="g-box[^"]*">([^<]*)</g)].map(m => m[1]).join("");
  assert.equal(boxes(riddleHTML(p, rs({ letters: [..."הנותרימ"], done: true }))), "הנותרים");
  assert.equal(boxes(riddleHTML(p, rs({ done: true, gaveUp: true }))), "הנותרים");
});
