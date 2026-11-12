import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../scripts/lib/games/rng.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { make } from "../scripts/lib/games/blur.mjs";
import { safeImg } from "../site/lib/esc.js";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const pool = () => buildPool(fixtureSeries(), { known: 60 });

test("deterministic for the same seed", () => {
  assert.deepEqual(make(pool(), makeRng("b"), emptyRecent()), make(pool(), makeRng("b"), emptyRecent()));
});

test("w342 safe photo, series ascending by votes, count matches", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const { puzzle, used } = make(p, makeRng("s" + i), emptyRecent());
    assert.ok(safeImg(puzzle.actor.photo));
    assert.ok(puzzle.actor.photo.includes("/w342/"));
    assert.equal(puzzle.count, puzzle.series.length);
    assert.ok(puzzle.count >= 2);
    assert.deepEqual(used, { actors: [puzzle.actor.name] });
    const votes = puzzle.series.map((n) => p.all.find((s) => s.name === n).tmdbVotes);
    assert.deepEqual(votes, [...votes].sort((a, b) => a - b));
  }
});

test("count covers the whole pool, not only known", () => {
  const p = buildPool(fixtureSeries(), { known: 5 });
  const { puzzle } = make(p, makeRng("x"), emptyRecent());
  const total = p.all.filter((s) => s.cast.some((c) => c.name === puzzle.actor.name)).length;
  assert.equal(puzzle.count, total);
});

test("skips recent actors", () => {
  const p = pool();
  const recent = emptyRecent();
  const first = make(p, makeRng("r"), recent).puzzle.actor.name;
  recent.actors.add(first);
  for (let i = 0; i < 20; i++) assert.notEqual(make(p, makeRng("r" + i), recent).puzzle.actor.name, first);
});

test("null when no actor has a usable photo", () => {
  const s = fixtureSeries().map((x) => ({ ...x, cast: x.cast.map((c) => ({ name: c.name })) }));
  assert.equal(make(buildPool(s, { known: 60 }), makeRng("n"), emptyRecent()), null);
});

test("ignores odd's recent actors", () => {
  const p = pool();
  const recent = emptyRecent();
  for (const [n] of p.actorsKnown) recent.oddActors.add(n);
  assert.deepEqual(make(p, makeRng("o"), recent), make(p, makeRng("o"), emptyRecent()));
});

test("null when every eligible actor is recent", () => {
  const p = pool();
  const recent = emptyRecent();
  for (const [n, ids] of p.actorsKnown) if (ids.length >= 2) recent.actors.add(n);
  assert.equal(make(p, makeRng("n"), recent), null);
});
