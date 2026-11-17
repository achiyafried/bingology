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

import { validateCharacters } from "../scripts/lib/mcu.mjs";
const ch = (id, o = {}) => ({ id, he: "ת'ור", en: "Thor", people: [74568], match: "Thor", poster: "movie:10195", ...o });
const IDS = new Set(["movie:10195", "movie:1726"]);

test("validateCharacters accepts good rows", () => {
  assert.deepEqual(validateCharacters([ch("thor"), ch("iron-man", { poster: "movie:1726", people: [3223, 1], match: "Stark|Iron Man" })], IDS), []);
});

test("validateCharacters: one error per problem, naming the row", () => {
  const errs = validateCharacters([
    ch("thor"), ch("thor"),                 // duplicate
    ch("Thor!"),                            // bad id
    ch("a", { people: [] }),                // no people
    ch("b", { people: ["74568"] }),         // not integers
    ch("c", { match: "(" }),                // bad regex
    ch("d", { poster: "movie:999" }),       // poster not in mcu.json
    ch("e", { he: "" }),                    // no Hebrew name
  ], IDS);
  for (const [i, re] of [[1, /duplicate/], [2, /id must/], [3, /people/], [4, /people/], [5, /match/], [6, /poster/], [7, /he/]])
    assert.ok(errs.some(e => e.startsWith(`row ${i}:`) && re.test(e)), `row ${i} ${re}: ${errs.join(" | ")}`);
});

test("the real mcu-characters.json is valid and has at least 30 characters", () => {
  const list = JSON.parse(readFileSync("mcu-characters.json", "utf8"));
  const ids = new Set(JSON.parse(readFileSync("mcu.json", "utf8")).map(r => r.id));
  assert.deepEqual(validateCharacters(list, ids), []);
  assert.ok(list.length >= 30, `characters: ${list.length}`);
});
