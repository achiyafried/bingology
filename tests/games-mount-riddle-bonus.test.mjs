// Bonus riddles: after today's riddle, tomorrow's and the day after's can be solved early; the result is
// saved to the riddle's own day, and today's states are left alone.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = { scrollY: 0, scrollTo() {} };
const { mountGames, riddleHTML, SENTINEL } = await import("../site/views/games.js");
const { loadDay } = await import("../site/lib/games/store.js");

const TODAY = "2026-11-13", D1 = "2026-11-14", D2 = "2026-11-15";
const rid = (answer, tmdbId) => ({ clue: "חידה על " + answer, answer, words: [answer.length], tmdbId });
let files = {};
const dayFile = (date, games) => ({ date, v: 1, used: {}, games });
const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } }; };
const fetched = [];
const fetchFn = async url => {
  fetched.push(url);
  const date = url.match(/(\d{4}-\d{2}-\d{2})/)[1];
  return files[date] ? { status: 200, ok: true, json: async () => files[date] } : { status: 404, ok: false };
};
const gr = { id: "gr", value: SENTINEL, focus() {} };
const play = { innerHTML: "" };
const root = { innerHTML: "", isConnected: true, contains: () => true, addEventListener() {}, querySelector: s => ({ "#gr": gr, ".g-rplay": play })[s] ?? null };
const tick = () => new Promise(r => setTimeout(r, 10));
const click = d => root.onclick({ target: { closest: () => ({ dataset: d, disabled: false }) } });
const solve = word => { gr.value = SENTINEL + word; root.oninput({ target: gr, inputType: "insertText", isComposing: false }); root.onkeydown({ target: gr, key: "Enter", isComposing: false, preventDefault() {} }); };

let storage;
async function start(f) {
  files = f; fetched.length = 0; storage = memStorage();
  mountGames(root, { S: [{ tmdbId: 1, n: "A" }], storage, actorNames: [], today: () => TODAY, fetch: fetchFn, openSeries() {}, openActor() {}, toast() {}, copy: async () => true, nav: true });
  await tick();
  click({ gretry: "" }); // the same day stays loaded across mounts: reload so this start's files and storage apply
  await tick();
  click({ g: "riddle" });
}

test("riddleHTML offers the bonus only once today's riddle is over, and only when asked to", () => {
  const p = rid("אבג", 1), done = { letters: [..."אבג"], hints: 0, tries: 0, done: true, gaveUp: false };
  assert.match(riddleHTML(p, done, { bonusOffer: true }), /data-rbonus/);
  assert.doesNotMatch(riddleHTML(p, done, {}), /data-rbonus/);
  assert.doesNotMatch(riddleHTML(p, { ...done, done: false }, { bonusOffer: true }), /data-rbonus/);
});

test("bonus loads tomorrow's and the day after's riddles; solving saves to that day only", async () => {
  await start({ [TODAY]: dayFile(TODAY, { riddle: rid("אבג", 1) }), [D1]: dayFile(D1, { riddle: rid("דהו", 2) }), [D2]: dayFile(D2, { riddle: rid("זחט", 3) }) });
  solve("אבג");
  const todayBefore = JSON.stringify(loadDay(storage, TODAY));
  click({ rbonus: "" });
  await tick();
  assert.ok(fetched.some(u => u.includes(D1)) && fetched.some(u => u.includes(D2)));
  assert.match(root.innerHTML, /החידה של מחר/);
  assert.match(root.innerHTML, /החידה של מחרתיים/);
  assert.match(root.innerHTML, /חידה על דהו/);
  solve("דהו");
  assert.equal(loadDay(storage, D1).riddle.done, true, "saved to tomorrow");
  assert.equal(JSON.stringify(loadDay(storage, TODAY)), todayBefore, "today untouched");
  click({ rbi: "1" });
  assert.match(root.innerHTML, /חידה על זחט/);
  assert.equal(loadDay(storage, D2).riddle, undefined, "not played yet, nothing saved");
});

test("a day without a riddle is skipped; none at all shows a message", async () => {
  await start({ [TODAY]: dayFile(TODAY, { riddle: rid("אבג", 1) }), [D1]: dayFile(D1, {}), [D2]: dayFile(D2, { riddle: rid("זחט", 3) }) });
  solve("אבג");
  click({ rbonus: "" });
  await tick();
  assert.doesNotMatch(root.innerHTML, /החידה של מחר</);
  assert.match(root.innerHTML, /החידה של מחרתיים/);
  assert.match(root.innerHTML, /חידה על זחט/);

  await start({ [TODAY]: dayFile(TODAY, { riddle: rid("אבג", 1) }) });
  solve("אבג");
  click({ rbonus: "" });
  await tick();
  assert.match(root.innerHTML, /אין עוד חידות כרגע/);
});

test("back from the bonus returns to today's riddle", async () => {
  await start({ [TODAY]: dayFile(TODAY, { riddle: rid("אבג", 1) }), [D1]: dayFile(D1, { riddle: rid("דהו", 2) }) });
  solve("אבג");
  click({ rbonus: "" });
  await tick();
  click({ rbback: "" });
  assert.match(root.innerHTML, /חידה על אבג/);
  assert.match(root.innerHTML, /data-rbonus/);
});
