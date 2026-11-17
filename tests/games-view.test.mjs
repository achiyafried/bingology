import { test } from "node:test";
import assert from "node:assert/strict";
import { hubHTML, summaryHTML, guessHTML, oddHTML, groupsHTML, blurHTML, riddleHTML, howHTML } from "../site/views/games.js";
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

test("hubHTML: four cards in order with their states and labels; a leftover chain puzzle is not shown", () => {
  const states = {
    guess: { guesses: [5, 1], done: true },
    odd: { picks: [1], done: false },
  };
  const h = hubHTML(day, states, 4);
  const order = [...h.matchAll(/data-g="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ["guess", "odd", "groups", "blur"]);
  const cardOf = id => h.slice(h.indexOf(`data-g="${id}"`), h.indexOf("</button>", h.indexOf(`data-g="${id}"`)));
  assert.match(cardOf("guess"), /סיים/);
  assert.match(cardOf("guess"), /2\/6/);
  assert.match(cardOf("odd"), /בתהליך/);
  assert.match(cardOf("groups"), /לשחק/);
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

test("howHTML: one muted line per game; none for the removed chain game", () => {
  assert.equal(howHTML("guess", guess), `<p class="g-how">נחשו את הסדרה. כל טעות חושפת רמז נוסף. יש 6 ניסיונות.</p>`);
  assert.match(howHTML("odd", odd), /שלוש מהסדרות הן של השחקן\/ית, אחת מתחזה\. מצאו אותה\./);
  assert.match(howHTML("groups", groups), /שבצו את 16 הסדרות לארבע הקבוצות שלמעלה\. בחרו 4 ולחצו שליחה\. מותר לטעות 4 פעמים\./);
  assert.match(howHTML("blur", blur), /מי השחקן\/ית\? כל טעות מחדדת את התמונה וחושפת רמז\. יש 5 ניסיונות\./);
  assert.equal(howHTML("chain", chain), "");
  for (const id of ["guess", "odd", "groups", "blur"]) assert.match(howHTML(id, { guess, odd, chain, groups, blur }[id]), /^<p class="g-how">/);
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
  assert.ok(h.includes("נסו את השם השני שלה: תרגום, או השם הלועזי באותיות עבריות"), "points at the other kind of name");
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

test("riddleHTML done: the boxes spell the answer with its final letters", () => {
  const p = { clue: "c", answer: "הנותרים", words: [7], tmdbId: 54344 };
  const boxes = h => [...h.matchAll(/class="g-box[^"]*">([^<]*)</g)].map(m => m[1]).join("");
  assert.equal(boxes(riddleHTML(p, rs({ letters: [..."הנותרימ"], done: true }))), "הנותרים");
  assert.equal(boxes(riddleHTML(p, rs({ done: true, gaveUp: true }))), "הנותרים");
});

test("howHTML riddle: the answer is the Hebrew name, a translation or a transliteration, with one example of each", () => {
  const h = howHTML("riddle", {});
  assert.match(h, /השם שבו הסדרה מוכרת בעברית/);
  assert.match(h, /תרגום \(שובר שורות\)/);
  assert.match(h, /השם הלועזי באותיות עבריות \(סיינפלד\)/);
});

test("riddleHTML credits the friend who sent the riddle, before and after solving", () => {
  const p = { clue: "רמז", answer: "אב", words: [2], tmdbId: 1, credit: "דני <b>" };
  const open = { letters: ["", ""], hints: 0, tries: 0, done: false, gaveUp: false };
  const done = { letters: ["א", "ב"], hints: 0, tries: 0, done: true, gaveUp: false };
  for (const s of [open, done]) assert.match(riddleHTML(p, s), /<p class="g-credit">חידה של <bdi>דני &lt;b&gt;<\/bdi><\/p>/);
  assert.doesNotMatch(riddleHTML({ ...p, credit: undefined }, open), /g-credit/);
});

test("hubHTML: a 'send us a riddle' link on today's games only", () => {
  const day = { date: "2026-11-17", games: {} };
  assert.match(hubHTML(day, {}, 0), /data-gsendriddle/);
  assert.match(hubHTML(day, {}, 0), /<a class="linkbtn" href="mailto:bingeislife@gmail\.com\?subject=/);
  assert.doesNotMatch(hubHTML(day, {}, 0, { guest: true }), /data-gsendriddle/);
  assert.doesNotMatch(hubHTML(day, {}, 0, { practice: true }), /data-gsendriddle/);
});
