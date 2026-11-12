import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { riddleKey, toPuzzle, validateRiddles, assignRiddles } from "../scripts/lib/games/riddles.mjs";
import { addDays } from "../site/lib/games/day.js";

const TODAY = "2026-11-12";
const IDS = new Set([1, 2, 3, 4]);
const R = (n, extra = {}) => ({ clue: "חידה " + n, answer: ["אבג", "דהו", "זחט", "יכל"][n - 1], tmdbId: n, ...extra });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "riddles-"));
const day = (date, games = { guess: { x: 1 } }, used = {}) => ({ date, v: 1, used, games });
const write = (dir, d) => fs.writeFileSync(path.join(dir, d.date + ".json"), JSON.stringify(d) + "\n");
const read = (dir, date) => JSON.parse(fs.readFileSync(path.join(dir, date + ".json"), "utf8"));
const week = dir => { for (let i = 0; i < 8; i++) write(dir, day(addDays(TODAY, i))); };
const silent = () => { const warns = []; return { warns, warn: m => warns.push(m), log() {} }; };

test("validateRiddles accepts a good file and flags each kind of bad row", () => {
  assert.deepEqual(validateRiddles([R(1), R(2, { date: "2026-11-20", explain: "הסבר" })], IDS), []);
  const bad = [
    [{ answer: "אבג", tmdbId: 1 }, /0.*clue/],
    [{ clue: "x", tmdbId: 1 }, /0.*answer/],
    [{ clue: "x", answer: "abc", tmdbId: 1 }, /0.*answer/],
    [{ clue: "x", answer: "   ", tmdbId: 1 }, /0.*answer/],
    [{ clue: "x", answer: "אבג", tmdbId: 99 }, /0.*tmdbId/],
    [{ clue: "x", answer: "אבג", tmdbId: 1, date: "20-11-2026" }, /0.*date/],
  ];
  for (const [row, re] of bad) {
    const errs = validateRiddles([row], IDS);
    assert.ok(errs.some(e => re.test(e)), `${JSON.stringify(row)} → ${errs}`);
  }
  assert.ok(validateRiddles([R(1), R(1)], IDS).some(e => /1.*duplicate/.test(e)));
  assert.ok(validateRiddles([R(1, { date: "2026-11-20" }), R(2, { date: "2026-11-20" })], IDS).some(e => /1.*date/.test(e)));
  assert.ok(validateRiddles({}, IDS).length > 0, "not an array");
});

test("riddleKey and toPuzzle", () => {
  assert.equal(riddleKey(R(1)), "1:אבג");
  assert.deepEqual(toPuzzle({ clue: "c", answer: "שובר שורות", tmdbId: 1396, explain: "e" }), { clue: "c", answer: "שובר שורות", words: [4, 5], tmdbId: 1396, explain: "e" });
  assert.equal("explain" in toPuzzle({ clue: "c", answer: "אב", tmdbId: 1 }), false);
});

test("assigns the next unused riddle, in file order, to each day without one", () => {
  const dir = tmp(); week(dir);
  const { assigned, empty } = assignRiddles({ riddles: [R(1), R(2), R(3)], dir, today: TODAY, log: silent() });
  assert.deepEqual(assigned, { [TODAY]: "1:אבג", [addDays(TODAY, 1)]: "2:דהו", [addDays(TODAY, 2)]: "3:זחט" });
  assert.equal(empty.length, 5);
  const d0 = read(dir, TODAY);
  assert.deepEqual(d0.games.riddle, toPuzzle(R(1)));
  assert.deepEqual(d0.used.riddles, ["1:אבג"]);
  assert.deepEqual(d0.games.guess, { x: 1 }, "other games untouched");
});

test("a dated riddle goes to its date and is skipped by the queue", () => {
  const dir = tmp(); week(dir);
  const dated = addDays(TODAY, 1);
  const { assigned } = assignRiddles({ riddles: [R(1, { date: dated }), R(2), R(3)], dir, today: TODAY, log: silent() });
  assert.equal(assigned[TODAY], "2:דהו");
  assert.equal(assigned[dated], "1:אבג");
  assert.equal(assigned[addDays(TODAY, 2)], "3:זחט");
});

test("a day that already has a riddle is left byte-identical", () => {
  const dir = tmp(); week(dir);
  write(dir, day(TODAY, { riddle: toPuzzle(R(4)) }, { riddles: ["4:יכל"] }));
  const before = fs.readFileSync(path.join(dir, TODAY + ".json"), "utf8");
  const { assigned } = assignRiddles({ riddles: [R(1)], dir, today: TODAY, log: silent() });
  assert.equal(fs.readFileSync(path.join(dir, TODAY + ".json"), "utf8"), before);
  assert.equal(assigned[addDays(TODAY, 1)], "1:אבג");
});

test("riddles already used in any existing file are not assigned again", () => {
  const dir = tmp(); week(dir);
  write(dir, day(addDays(TODAY, -30), {}, { riddles: ["1:אבג"] }));
  const { assigned } = assignRiddles({ riddles: [R(1), R(2)], dir, today: TODAY, log: silent() });
  assert.equal(assigned[TODAY], "2:דהו");
  assert.equal(Object.values(assigned).includes("1:אבג"), false);
});

test("a dated riddle whose date is before today is never assigned", () => {
  const dir = tmp(); week(dir);
  const { assigned } = assignRiddles({ riddles: [R(1, { date: addDays(TODAY, -1) })], dir, today: TODAY, log: silent() });
  assert.deepEqual(assigned, {});
});

test("empty bank: days keep their other games and each gets a warning", () => {
  const dir = tmp(); week(dir);
  const log = silent();
  const { assigned, empty } = assignRiddles({ riddles: [], dir, today: TODAY, log });
  assert.deepEqual(assigned, {});
  assert.equal(empty.length, 8);
  assert.ok(log.warns.includes(`make-games: no riddle for ${TODAY}`));
  assert.equal("riddle" in read(dir, TODAY).games, false);
});

test("a missing day file in the window is skipped, not created", () => {
  const dir = tmp(); write(dir, day(TODAY));
  const { assigned } = assignRiddles({ riddles: [R(1), R(2)], dir, today: TODAY, log: silent() });
  assert.deepEqual(Object.keys(assigned), [TODAY]);
  assert.equal(fs.existsSync(path.join(dir, addDays(TODAY, 1) + ".json")), false);
});
