import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeDays, buildDay, ODD_RECENT_DAYS } from "../scripts/lib/games/make.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { GAMES, addDays, israelToday } from "../site/lib/games/day.js";
import { fixtureSeries } from "./lib/games-fixture.mjs";
import * as guess from "../scripts/lib/games/guess.mjs";
import * as odd from "../scripts/lib/games/odd.mjs";
import * as chain from "../scripts/lib/games/chain.mjs";
import * as groups from "../scripts/lib/games/groups.mjs";
import * as blur from "../scripts/lib/games/blur.mjs";

const silent = { warn() {}, log() {} };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "games-make-"));
const TODAY = "2026-11-12";
const opts = (dir, extra = {}) => ({ series: fixtureSeries(), dir, today: TODAY, log: silent, known: 60, ...extra });
const read = (dir, d) => JSON.parse(fs.readFileSync(path.join(dir, d + ".json"), "utf8"));

test("creates exactly the 8 missing dates", () => {
  const dir = tmp();
  const { created } = makeDays(opts(dir));
  const want = Array.from({ length: 8 }, (_, i) => addDays(TODAY, i));
  assert.deepEqual(created, want);
  assert.deepEqual(fs.readdirSync(dir).sort(), want.map((d) => d + ".json"));
  const f = read(dir, TODAY);
  assert.equal(f.date, TODAY);
  assert.equal(f.v, 1);
  assert.deepEqual(Object.keys(f.games), GAMES.map((g) => g.id));
});

test("an existing file is never rewritten", async () => {
  const dir = tmp();
  const file = path.join(dir, TODAY + ".json");
  fs.writeFileSync(file, '{"date":"2026-11-12","v":1,"used":{},"games":{}}\n');
  const old = new Date("2020-01-01T00:00:00Z");
  fs.utimesSync(file, old, old);
  const before = fs.readFileSync(file);
  const { created } = makeDays(opts(dir));
  assert.equal(created.length, 7);
  assert.ok(!created.includes(TODAY));
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.statSync(file).mtimeMs, old.getTime());
});

test("a generator that always returns null drops that game, warns, never throws", () => {
  const dir = tmp();
  const warns = [];
  const gens = { guess, odd, chain, groups, blur: { make: () => null } };
  const { created, missing } = makeDays(opts(dir, { gens, log: { warn: (m) => warns.push(m), log() {} } }));
  assert.equal(created.length, 8);
  const f = read(dir, TODAY);
  assert.ok(!("blur" in f.games));
  assert.ok("guess" in f.games);
  assert.ok(missing[TODAY].includes("blur"));
  assert.equal(warns.filter((w) => w.includes("no blur puzzle")).length, 8);
});

test("a generator that throws counts as a failed attempt", () => {
  const dir = tmp();
  const gens = { guess, odd, chain, groups, blur: { make: () => { throw new Error("bad data"); } } };
  const { missing } = makeDays(opts(dir, { gens, days: 1 }));
  assert.deepEqual(missing[TODAY], ["blur"]);
});

test("files older than 90 days are deleted, only .json", () => {
  const dir = tmp();
  const old = addDays(TODAY, -91);
  const edge = addDays(TODAY, -90);
  for (const n of [old + ".json", edge + ".json", old + ".txt"]) fs.writeFileSync(path.join(dir, n), "{}");
  const { deleted } = makeDays(opts(dir, { days: 1 }));
  assert.deepEqual(deleted, [old + ".json"]);
  assert.ok(!fs.existsSync(path.join(dir, old + ".json")));
  assert.ok(fs.existsSync(path.join(dir, edge + ".json")));
  assert.ok(fs.existsSync(path.join(dir, old + ".txt")));
});

test("a day created in the same run feeds the next day's recent", () => {
  const dir = tmp();
  makeDays(opts(dir));
  const d1 = read(dir, TODAY), d2 = read(dir, addDays(TODAY, 1));
  assert.ok(d1.games.guess && d2.games.guess);
  assert.notEqual(d1.games.guess.answer.id, d2.games.guess.answer.id);
  assert.ok(d1.used.series.includes(d1.games.guess.answer.id));
  assert.equal(new Set(d1.used.series).size, d1.used.series.length);
});

test("unreadable files are skipped with a warning", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, addDays(TODAY, -1) + ".json"), "{not json");
  const warns = [];
  makeDays(opts(dir, { days: 1, log: { warn: (m) => warns.push(m), log() {} } }));
  assert.ok(warns.some((w) => w.includes(addDays(TODAY, -1))));
});

test("today at 22:30Z is already tomorrow in Israel", () => {
  const dir = tmp();
  const { created } = makeDays(opts(dir, { today: israelToday(new Date("2026-11-12T22:30:00Z")) }));
  assert.equal(created[0], "2026-11-13");
});

test("odd actors use a 20-day window, other games keep 60", () => {
  assert.equal(ODD_RECENT_DAYS, 20);
  const dir = tmp();
  const put = (n, used) => fs.writeFileSync(path.join(dir, addDays(TODAY, -n) + ".json"), JSON.stringify({ used }));
  put(21, { actors: ["Old"], series: [101] });
  put(19, { actors: ["Fresh"], series: [102] });
  const seen = {};
  const spy = (id) => ({ make: (pool, rng, recent) => {
    seen[id] ??= { actors: [...recent.actors], series: [...recent.series] };
    return null;
  } });
  makeDays(opts(dir, { days: 1, gens: { guess: spy("guess"), odd: spy("odd"), chain, groups, blur } }));
  assert.deepEqual(seen.odd.actors, ["Fresh"]);
  assert.deepEqual(seen.guess.series.sort(), [101, 102]);
  assert.deepEqual(seen.guess.actors.sort(), ["Fresh", "Old"]);
});

const dataPath = new URL("../site/data.json", import.meta.url);
test("real data: each game present on >= 27 of 30 days", { skip: !fs.existsSync(dataPath) }, () => {
  const series = JSON.parse(fs.readFileSync(dataPath, "utf8")).series;
  const pool = buildPool(series);
  const recent = emptyRecent();
  const counts = Object.fromEntries(GAMES.map((g) => [g.id, 0]));
  const days = [];
  for (let i = 0; i < 30; i++) {
    const oddRecent = emptyRecent();
    for (const d of days.slice(-ODD_RECENT_DAYS)) for (const a of d.used.actors ?? []) oddRecent.actors.add(a);
    const day = buildDay(pool, addDays("2026-12-01", i), recent, silent, undefined, oddRecent);
    days.push(day);
    for (const id of Object.keys(day.games)) counts[id]++;
    for (const s of day.used.series ?? []) recent.series.add(s);
    for (const a of day.used.actors ?? []) recent.actors.add(a);
    for (const p of day.used.pairs ?? []) recent.pairs.add(p);
  }
  for (const [id, n] of Object.entries(counts)) assert.ok(n >= 27, `${id} present on ${n}/30 days`);
});
