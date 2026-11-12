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
    assert.deepEqual(used, {});
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
      if (g.kind === "year") assert.equal(g.label, `בכורה ב-${g.key}`);
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
  const s = { cast: [{ name: "A" }], creators: ["C"], year: 2001, lang: "ko" };
  assert.ok(fits("actor", "A", s) && !fits("actor", "B", s));
  assert.ok(fits("creator", "C", s) && !fits("creator", "D", s));
  assert.ok(fits("year", 2001, s) && !fits("year", 2002, s));
  assert.ok(fits("lang", "ko", s) && !fits("lang", "en", s));
});

test("returns null on a tiny pool", () => {
  assert.equal(make(buildPool(fixtureSeries().slice(0, 10), { known: 10 }), makeRng("s"), emptyRecent()), null);
});
