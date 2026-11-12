import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../scripts/lib/games/rng.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { make, fits } from "../scripts/lib/games/groups.mjs";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const pool = () => buildPool(fixtureSeries(), { known: 60 });
const mean = (p, g) => g.ids.reduce((a, id) => a + (p.byId.get(id).tmdbVotes ?? 0), 0) / g.ids.length;

test("deterministic for the same seed", () => {
  assert.deepEqual(make(pool(), makeRng("g"), emptyRecent()), make(pool(), makeRng("g"), emptyRecent()));
});

test("16 distinct items in 4 groups of 4 spanning at least 3 kinds", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const { puzzle, used } = make(p, makeRng("s" + i), emptyRecent());
    assert.deepEqual(used, { groups: puzzle.groups.map((g) => `${g.kind}:${g.key}`) });
    assert.equal(puzzle.items.length, 16);
    assert.equal(new Set(puzzle.items.map((c) => c.id)).size, 16);
    assert.equal(puzzle.groups.length, 4);
    for (const g of puzzle.groups) {
      assert.equal(g.ids.length, 4);
      for (const id of g.ids) assert.ok(puzzle.items.some((c) => c.id === id));
    }
    assert.ok(new Set(puzzle.groups.map((g) => g.kind)).size >= 3);
    for (const c of puzzle.items) assert.deepEqual(Object.keys(c), ["id", "name", "poster"]);
  }
});

test("levels are 1-4 ordered by mean votes, most votes = 1", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const { puzzle } = make(p, makeRng("l" + i), emptyRecent());
    assert.deepEqual(puzzle.groups.map((g) => g.level).sort(), [1, 2, 3, 4]);
    const byLevel = [...puzzle.groups].sort((a, b) => a.level - b.level).map((g) => mean(p, g));
    for (let k = 1; k < 4; k++) assert.ok(byLevel[k - 1] >= byLevel[k]);
  }
});

test("exclusive: no item fits another group, and each group member fits its own", () => {
  const p = pool();
  for (let i = 0; i < 30; i++) {
    const { puzzle } = make(p, makeRng("x" + i), emptyRecent());
    for (const g of puzzle.groups) {
      for (const id of g.ids) assert.ok(fits(g.kind, g.key, p.byId.get(id)));
      for (const o of puzzle.groups) {
        if (o === g) continue;
        for (const id of g.ids) assert.equal(fits(o.kind, o.key, p.byId.get(id)), false);
      }
    }
  }
});

test("labels follow the Hebrew formats", () => {
  const p = pool();
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    for (const g of make(p, makeRng("t" + i), emptyRecent()).puzzle.groups) {
      seen.add(g.kind);
      if (g.kind === "actor") assert.equal(g.label, `שחקן/ית משותף/ת: ${g.key}`);
      if (g.kind === "creator") assert.equal(g.label, `יוצר/ת: ${g.key}`);
      assert.notEqual(g.kind, "year");
      if (g.kind === "decade") {
        assert.equal(g.key % 10, 0);
        assert.equal(g.label, `שנות ה-${g.key}`);
      }
      if (g.kind === "lang") {
        assert.notEqual(g.key, "en");
        assert.match(g.label, /^בשפה: \S/);
        assert.ok(!g.label.includes("ko"));
      }
    }
  }
  assert.ok(seen.has("lang"));
});

test("fits matches each kind", () => {
  const s = { cast: [{ name: "A" }], creators: ["C"], year: 2009, lang: "ko" };
  assert.ok(fits("actor", "A", s) && !fits("actor", "B", s));
  assert.ok(fits("creator", "C", s) && !fits("creator", "D", s));
  assert.ok(fits("decade", 2000, s) && !fits("decade", 2010, s) && !fits("decade", 2009, s));
  assert.ok(!fits("year", 2009, s));
  assert.ok(fits("decade", 2010, { year: 2010 }) && !fits("decade", 2000, { year: null }));
  assert.ok(fits("lang", "ko", s) && !fits("lang", "en", s));
});

test("returns null on a tiny pool", () => {
  assert.equal(make(buildPool(fixtureSeries().slice(0, 10), { known: 10 }), makeRng("s"), emptyRecent()), null);
});

test("draws from the wide pool, beyond known", () => {
  const p = buildPool(fixtureSeries(), { known: 10 });
  let outside = 0;
  for (let i = 0; i < 10; i++) {
    const { puzzle } = make(p, makeRng("w" + i), emptyRecent());
    for (const c of puzzle.items) if (!p.knownIds.has(c.id)) outside++;
  }
  assert.ok(outside > 0);
});

test("skips recent group keys; null when all are recent", () => {
  const p = pool();
  const recent = emptyRecent();
  // The fixture has only 3 keys outside actor/creator (lang:ko and two decades) and each day needs one.
  let days = 0;
  for (let i = 0; i < 5; i++) {
    const r = make(p, makeRng("k" + i), recent);
    if (!r) break;
    days++;
    const { used } = r;
    for (const k of used.groups) {
      assert.ok(!recent.groups.has(k), k);
      recent.groups.add(k);
    }
  }
  assert.ok(days >= 2, `${days} days`);
  const all = emptyRecent();
  for (const s of p.all) {
    for (const c of s.cast) all.groups.add(`actor:${c.name}`);
    for (const c of s.creators) all.groups.add(`creator:${c}`);
    all.groups.add(`decade:${Math.floor(s.year / 10) * 10}`);
    all.groups.add(`lang:${s.lang}`);
  }
  assert.equal(make(p, makeRng("k"), all), null);
});

test("decade groups: label for 2000 and 2010", () => {
  const seen = new Map();
  const p = pool();
  for (let i = 0; i < 60; i++) for (const g of make(p, makeRng("d" + i), emptyRecent()).puzzle.groups) if (g.kind === "decade") seen.set(g.key, g.label);
  assert.ok(seen.size > 0);
  if (seen.has(2000)) assert.equal(seen.get(2000), "שנות ה-2000");
  if (seen.has(2010)) assert.equal(seen.get(2010), "שנות ה-2010");
});

test("actor groups only hold series where the actor is billed in the first 5 names", () => {
  const series = fixtureSeries();
  // "Deep" sits 6th or lower in 6 series and first in 3: never enough for a group of 4.
  for (const s of series) {
    if (s.tmdbId <= 3) s.cast.unshift({ name: "Deep", photo: null });
    else if (s.tmdbId <= 9) s.cast.push({ name: "Deep", photo: null });
  }
  const p = buildPool(series, { known: 60 });
  for (let i = 0; i < 40; i++) {
    for (const g of make(p, makeRng("a" + i), emptyRecent()).puzzle.groups) {
      assert.notEqual(g.key, "Deep");
      if (g.kind !== "actor") continue;
      for (const id of g.ids) assert.ok(p.byId.get(id).cast.findIndex((c) => c.name === g.key) < 5, `${g.key} in ${id}`);
    }
  }
});
