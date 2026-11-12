import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../scripts/lib/games/rng.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { make } from "../scripts/lib/games/odd.mjs";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const pool = () => buildPool(fixtureSeries(), { known: 60 });
const has = (s, name) => s.cast.some((c) => c.name === name);

test("deterministic for the same seed", () => {
  assert.deepEqual(make(pool(), makeRng("s"), emptyRecent()), make(pool(), makeRng("s"), emptyRecent()));
});

test("3 rounds, distinct actors, odd one lacks the actor", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const r = make(p, makeRng("o" + i), emptyRecent());
    assert.equal(r.puzzle.rounds.length, 3);
    const names = r.puzzle.rounds.map((x) => x.actor.name);
    assert.equal(new Set(names).size, 3);
    assert.deepEqual(r.used, { actors: names });
    for (const round of r.puzzle.rounds) {
      assert.equal(round.series.length, 4);
      assert.equal(new Set(round.series.map((c) => c.id)).size, 4);
      assert.ok(round.odd >= 0 && round.odd <= 3);
      assert.equal(round.actor.photo, p.photo.get(round.actor.name) ?? null);
      round.series.forEach((c, k) => {
        assert.ok(p.knownIds.has(c.id));
        assert.equal(has(p.byId.get(c.id), round.actor.name), k !== round.odd);
      });
    }
  }
});

test("impostor shares a genre and is within 5 years of the others", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const r = make(p, makeRng("g" + i), emptyRecent());
    for (const round of r.puzzle.rounds) {
      const all = round.series.map((c) => p.byId.get(c.id));
      const imp = all[round.odd];
      const three = all.filter((_, k) => k !== round.odd);
      assert.ok(three.some((t) => t.genres.some((g) => imp.genres.includes(g))));
      assert.ok(three.some((t) => Math.abs(t.year - imp.year) <= 5));
    }
  }
});

test("skips recent actors", () => {
  const p = pool();
  const first = make(p, makeRng("r"), emptyRecent());
  const recent = emptyRecent();
  for (const n of first.used.actors) recent.actors.add(n);
  const r = make(p, makeRng("r"), recent);
  for (const n of r.used.actors) assert.ok(!recent.actors.has(n));
});

test("null when no actor has 3 known series, or pool is empty", () => {
  const p = buildPool(fixtureSeries(), { known: 2 });
  assert.equal(make(p, makeRng("x"), emptyRecent()), null);
  assert.equal(make(buildPool([], { known: 5 }), makeRng("x"), emptyRecent()), null);
});
