import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeDays, ODD_RECENT_DAYS, GROUPS_RECENT_DAYS } from "../scripts/lib/games/make.mjs";
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

test("days created in the same run feed later days' recent", () => {
  const dir = tmp();
  const answers = [];
  const seen = [];
  const spy = {
    make: (pool, rng, recent) => {
      seen.push([...recent.series]);
      const id = 1000 + answers.length;
      answers.push(id);
      return { puzzle: { id }, used: { series: [id] } };
    },
  };
  makeDays(opts(dir, { gens: { guess: spy, odd, chain, groups, blur } }));
  assert.equal(seen.length, 8);
  assert.deepEqual(seen[0], []);
  assert.deepEqual(seen[1], [answers[0]]);
  assert.deepEqual([...seen[7]].sort(), answers.slice(0, 7));
});

test("a throwing generator's message appears in the warning", () => {
  const warns = [];
  const gens = { guess, odd, chain, groups, blur: { make: () => { throw new Error("boom"); } } };
  makeDays(opts(tmp(), { gens, days: 1, log: { warn: (m) => warns.push(m), log() {} } }));
  assert.ok(warns.some((w) => w.includes("blur") && w.includes("boom")));
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

test("windows: odd actors 14 days, groups 7, other keys 60; odd and blur actors are separate", () => {
  assert.equal(ODD_RECENT_DAYS, 14);
  assert.equal(GROUPS_RECENT_DAYS, 7);
  const dir = tmp();
  const put = (n, used) => fs.writeFileSync(path.join(dir, addDays(TODAY, -n) + ".json"), JSON.stringify({ used }));
  put(15, { oddActors: ["OldOdd"], actors: ["BlurA"], series: [101], groups: ["decade:1990"] });
  put(8, { groups: ["decade:2000"] });
  put(6, { oddActors: ["FreshOdd"], actors: ["BlurB"], series: [102], groups: ["decade:2010"] });
  const seen = {};
  const spy = (id) => ({ make: (pool, rng, recent) => {
    seen[id] ??= Object.fromEntries(Object.entries(recent).map(([k, v]) => [k, [...v].sort()]));
    return null;
  } });
  makeDays(opts(dir, { days: 1, gens: { guess: spy("guess"), odd: spy("odd"), chain, groups: spy("groups"), blur: spy("blur") } }));
  assert.deepEqual(seen.odd.oddActors, ["FreshOdd"]);
  assert.deepEqual(seen.blur.actors, ["BlurA", "BlurB"]);
  assert.deepEqual(seen.groups.groups, ["decade:2010"]);
  assert.deepEqual(seen.guess.series, [101, 102]);
});

test("blur avoids the same day's odd actors, without changing other games' recent", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, addDays(TODAY, -1) + ".json"), JSON.stringify({ used: { actors: ["Yesterday"] } }));
  const seen = {};
  const spy = (id, used) => ({ make: (pool, rng, recent) => { seen[id] = [...recent.actors].sort(); return { puzzle: {}, used }; } });
  const gens = { guess: spy("guess", {}), odd: spy("odd", { oddActors: ["O1", "O2", "O3"] }), chain: spy("chain", {}), groups: spy("groups", {}), blur: spy("blur", { actors: ["B"] }) };
  makeDays(opts(dir, { days: 2, gens }));
  // seen = the second day: earlier blur actors are recent for everyone; that day's odd actors only for blur.
  assert.deepEqual(seen.blur, ["B", "O1", "O2", "O3", "Yesterday"]);
  assert.deepEqual(seen.chain, ["B", "Yesterday"]);
  assert.deepEqual(read(dir, TODAY).used.actors, ["B"]);
});

test("day file records every used key", () => {
  const dir = tmp();
  makeDays(opts(dir, { days: 1 }));
  const f = read(dir, TODAY);
  assert.deepEqual(Object.keys(f.used).sort(), ["actors", "groups", "oddActors", "pairs", "series"]);
  assert.equal(f.used.groups.length, 4);
  assert.equal(f.used.oddActors.length, 3);
  assert.deepEqual(f.used.oddActors, f.games.odd.rounds.map((r) => r.actor.name));
  assert.deepEqual(f.used.actors, [f.games.blur.actor.name]);
});

const dataPath = new URL("../site/data.json", import.meta.url);
test("real data: 30 nights through makeDays", { skip: !fs.existsSync(dataPath) }, () => {
  const series = JSON.parse(fs.readFileSync(dataPath, "utf8")).series;
  const dir = tmp();
  const start = "2026-12-01";
  makeDays({ series, dir, today: start, days: 30, log: silent });
  const days = Array.from({ length: 30 }, (_, i) => read(dir, addDays(start, i)));
  const counts = Object.fromEntries(GAMES.map((g) => [g.id, 0]));
  for (const d of days) for (const id of Object.keys(d.games)) counts[id]++;

  days.forEach((d, i) => {
    for (const k of d.used.groups) {
      for (const prev of days.slice(Math.max(0, i - GROUPS_RECENT_DAYS), i)) {
        assert.ok(!prev.used.groups.includes(k), `${k} repeats ${d.date} after ${prev.date}`);
      }
    }
  });
  const actorDays = days.filter((d) => d.games.groups?.groups.some((g) => g.kind === "actor")).length;
  assert.ok(actorDays >= 5, `actor groups on ${actorDays}/30 days`);

  const blurCounts = days.filter((d) => d.games.blur).map((d) => d.games.blur.count);
  assert.ok(blurCounts.some((c) => c > 2), `blur counts ${blurCounts}`);

  for (const d of days) {
    const oddNames = d.games.odd?.rounds.map((r) => r.actor.name) ?? [];
    if (d.games.blur) assert.ok(!oddNames.includes(d.games.blur.actor.name), `${d.date} blur actor shown in odd`);
  }
  for (const d of days) {
    if (d.games.chain) assert.ok(Object.keys(d.games.chain.series).length >= 8, `${d.date} chain size`);
  }

  // Easier games: lead roles only, chain always 2 actors, decades instead of single years.
  const byVotes = [...series].filter((s) => s && s.tmdbId != null).sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0));
  const top600 = new Set(byVotes.slice(0, 600).map((s) => s.tmdbId));
  const leadIn = (name, n) => series.filter((s) => s && (s.cast ?? []).slice(0, n).some((c) => c.name === name));
  for (const d of days) {
    for (const r of d.games.odd?.rounds ?? []) {
      const leads = leadIn(r.actor.name, 5);
      assert.ok(leads.length >= 3, `${d.date} odd ${r.actor.name}: ${leads.length} lead series`);
      assert.ok(leads.filter((s) => top600.has(s.tmdbId)).length >= 2, `${d.date} odd ${r.actor.name}: top-600 leads`);
      const shown = r.series.filter((_, k) => k !== r.odd).map((c) => c.id).sort();
      const most = leads.sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0) || a.tmdbId - b.tmdbId).slice(0, 3).map((s) => s.tmdbId).sort();
      assert.deepEqual(shown, most, `${d.date} odd ${r.actor.name}: most-voted lead series`);
    }
    if (d.games.blur) {
      const name = d.games.blur.actor.name;
      assert.ok(leadIn(name, 3).filter((s) => top600.has(s.tmdbId)).length >= 2, `${d.date} blur ${name}`);
    }
    if (d.games.chain) {
      assert.equal(d.games.chain.shortest, 2, `${d.date} chain shortest`);
      assert.equal(d.games.chain.limit, 4, `${d.date} chain limit`);
    }
    for (const g of d.games.groups?.groups ?? []) assert.notEqual(g.kind, "year", `${d.date} year group`);
  }
  // Last, so a short game doesn't hide the rule checks above.
  for (const [id, n] of Object.entries(counts)) assert.ok(n >= 27, `${id} present on ${n}/30 days`);
});
