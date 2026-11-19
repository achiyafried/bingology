import { test } from "node:test";
import assert from "node:assert/strict";
import { headerHTML, servicesHTML, gridHTML, cardHTML, gameHTML } from "../site/kids/view.js";
import { initGame, guess } from "../site/kids/game.js";

const P = "https://image.tmdb.org/t/p/w342/a.jpg";
const x = (tmdb, o = {}) => ({ tmdb, age: "mid", name: `Show ${tmdb}`, nameHe: `סדרה ${tmdb}`, poster: P, overview: "תקציר", overviewEn: "EN", year: 2020, seasons: 2, vote: 7, minAge: 0, providers: ["netflix"], providersGuess: [], ...o });
const bad = x(9, { name: "<b>x</b>", nameHe: "<b>y</b>", overview: "<i>o</i>" });

test("headerHTML: back link, title, pressed age, game button", () => {
  const h = headerHTML("big");
  assert.match(h, /href="\.\/"/);
  assert.match(h, /🧸 ילדים/);
  assert.match(h, /data-a="age" data-v="big" aria-pressed="true"/);
  assert.match(h, /data-a="age" data-v="small" aria-pressed="false"/);
  assert.match(h, /data-a="game"/);
  assert.match(h, /משחק היום/);
  assert.match(h, /<bdi dir="ltr">10–13<\/bdi>/, "the range reads left to right inside RTL");
});

test("servicesHTML: 'all' pressed when nothing is selected; empty when no services", () => {
  const h = servicesHTML(["netflix", "disney"], []);
  assert.match(h, /data-a="svc" data-v="" aria-pressed="true">הכול/);
  assert.match(h, /data-v="disney" aria-pressed="false">Disney\+/);
  assert.match(servicesHTML(["netflix"], ["netflix"]), /data-v="netflix" aria-pressed="true"/);
  assert.equal(servicesHTML([], []), "");
});

test("gridHTML: cards, escaped names, placeholder without a poster, empty message", () => {
  const h = gridHTML([x(1), x(2, { poster: null }), bad]);
  assert.match(h, /data-a="card" data-v="1"/);
  assert.match(h, /k-noposter/);
  assert.ok(!h.includes("<b>"));
  assert.match(h, /&lt;b&gt;y/);
  assert.match(gridHTML([]), /אין כאן סדרות בשירות הזה 🙈/);
});

test("cardHTML: details, guessed Disney, no-service text, escaping", () => {
  const h = cardHTML(x(1, { providers: ["netflix", "disney"], providersGuess: ["disney"] }));
  assert.match(h, /סדרה 1/);
  assert.match(h, /Show 1/);
  assert.match(h, /ילדים <bdi dir="ltr">6–9<\/bdi>/);
  assert.match(h, /2 עונות · 2020/);
  assert.match(h, /Netflix, Disney\+ \(כנראה\)/);
  assert.match(h, /data-a="close"/);
  assert.match(cardHTML(x(2, { providers: [] })), /לא מצאנו איפה רואים אותה בישראל/);
  assert.match(cardHTML(x(3, { overview: null })), /EN/);
  const b = cardHTML(bad);
  assert.ok(!b.includes("<b>") && !b.includes("<i>"));
});

test("gameHTML: blurred at start, choices, misses, win and loss", () => {
  const items = [x(1), x(2), x(3), bad];
  const p = { answer: 1, choices: [2, 1, 3, 9] };
  let st = initGame(p);
  let h = gameHTML(p, st, items);
  assert.match(h, /filter: blur\(28px\)/);
  assert.equal((h.match(/data-a="pick"/g) || []).length, 4);
  assert.ok(!h.includes("<b>"));
  st = guess(st, 2);
  h = gameHTML(p, st, items);
  assert.match(h, /class="k-pick miss" data-a="pick" data-v="2" disabled/);
  assert.match(h, /blur\(18px\)/);
  h = gameHTML(p, guess(st, 1), items);
  assert.match(h, /blur\(0px\)/);
  assert.match(h, /כל הכבוד! 🎉/);
  assert.match(h, /data-a="card" data-v="1"/);
  h = gameHTML(p, guess(guess(st, 3), 9), items);
  assert.match(h, /זאת הייתה סדרה 1/);
  assert.match(gameHTML(null, null, items), /אין עדיין משחק לקבוצה הזו/);
});

test("no YouTube anywhere", () => {
  const all = headerHTML("mid") + gridHTML([x(1)]) + cardHTML(x(1)) + gameHTML({ answer: 1, choices: [1, 2] }, initGame({ answer: 1, choices: [1, 2] }), [x(1), x(2)]);
  assert.ok(!/youtube/i.test(all));
});
