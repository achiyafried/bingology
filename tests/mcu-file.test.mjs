import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMcu } from "../scripts/lib/mcu.mjs";

const mv = (tmdb, o = {}) => ({ id: `movie:${tmdb}`, tmdb, kind: "movie", era: "שנות ה-40", story: "1943", phase: 1, ...o });
const ss = (tmdb, season, o = {}) => ({ id: `tv:${tmdb}:s${season}`, tmdb, kind: "season", season, era: "אחרי הבליפ", story: "2023", phase: 4, ...o });

test("validateMcu accepts good rows", () => {
  assert.deepEqual(validateMcu([mv(1771), ss(84958, 1, { note: "שנוי במחלוקת" }), ss(84958, 2)]), []);
});

test("validateMcu: one error per problem, naming the row", () => {
  const errs = validateMcu([
    mv(1), mv(1),                                   // duplicate id
    { ...mv(2), id: "movie:3" },                    // id does not match
    { ...mv(4), era: "" },                          // no era
    { ...mv(5), story: undefined },                 // no story
    { ...ss(6, 1), season: 0, id: "tv:6:s0" },      // season < 1
    { ...mv(7), phase: 7 },                         // phase out of range
    { ...mv(8), kind: "special" },                  // unknown kind
    { ...mv(9), tmdb: "9" },                        // tmdb not a number
  ]);
  for (const [i, re] of [[1, /duplicate id/], [2, /id must be/], [3, /era/], [4, /story/], [5, /season/], [6, /phase/], [7, /kind/], [8, /tmdb/]])
    assert.ok(errs.some(e => e.startsWith(`row ${i}:`) && re.test(e)), `row ${i} ${re}: ${errs.join(" | ")}`);
  assert.equal(validateMcu("x").length, 1);
});

test("the real mcu.json is valid and has at least 50 items", () => {
  const list = JSON.parse(readFileSync("mcu.json", "utf8"));
  assert.deepEqual(validateMcu(list), []);
  assert.ok(list.length >= 50, `items: ${list.length}`);
});
