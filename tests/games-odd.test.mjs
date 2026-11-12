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
    assert.deepEqual(r.used, { oddActors: names });
    for (const round of r.puzzle.rounds) {
      assert.equal(round.series.length, 4);
      assert.equal(new Set(round.series.map((c) => c.id)).size, 4);
      assert.ok(round.odd >= 0 && round.odd <= 3);
      assert.equal(round.actor.photo, p.photo.get(round.actor.name) ?? null);
      round.series.forEach((c, k) => {
        assert.ok(k === round.odd ? p.knownIds.has(c.id) : p.byId.has(c.id));
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
  for (const n of first.used.oddActors) recent.oddActors.add(n);
  const r = make(p, makeRng("r"), recent);
  for (const n of r.used.oddActors) assert.ok(!recent.oddActors.has(n));
});

test("ignores blur's recent actors", () => {
  const p = pool();
  const recent = emptyRecent();
  for (const s of p.all) for (const c of s.cast) recent.actors.add(c.name);
  assert.deepEqual(make(p, makeRng("r"), recent), make(p, makeRng("r"), emptyRecent()));
});

test("null when no actor has 2 top-600 lead series, or pool is empty", () => {
  const p = narrowWide(buildPool(fixtureSeries(), { known: 60 }), fixtureSeries().map((s) => s.tmdbId).slice(1));
  assert.equal(make(p, makeRng("x"), emptyRecent()), null);
  assert.equal(make(buildPool([], { known: 5 }), makeRng("x"), emptyRecent()), null);
});

const withActors = (names, ids, { lead = true } = {}) => {
  const series = fixtureSeries();
  for (const s of series) {
    if (!ids.includes(s.tmdbId)) continue;
    const add = names.map((n) => ({ name: n, photo: null }));
    s.cast = lead ? [...add, ...s.cast] : [...s.cast, ...add];
  }
  return series;
};
const onlyRecentExcept = (p, keep) => {
  const recent = emptyRecent();
  for (const s of p.all) for (const c of s.cast) if (!keep.includes(c.name)) recent.oddActors.add(c.name);
  return recent;
};
// The fixture has 60 series, all inside the top 600: narrow `wide` to test the "2 of them in the top 600" rule.
const narrowWide = (p, out) => ({ ...p, wide: p.wide.filter((s) => !out.includes(s.tmdbId)) });
const billing = (s, name) => s.cast.findIndex((c) => c.name === name);

test("every shown actor is billed in the first 5 names of the 3 series shown", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    for (const round of make(p, makeRng("b" + i), emptyRecent()).puzzle.rounds) {
      round.series.forEach((c, k) => {
        if (k !== round.odd) assert.ok(billing(p.byId.get(c.id), round.actor.name) < 5);
      });
    }
  }
});

test("an actor with 3 lead series but only 1 in the top 600 is never chosen", () => {
  const p = narrowWide(buildPool(withActors(["Solo Actor"], [1, 59, 60]), { known: 60 }), [59, 60]);
  for (let i = 0; i < 30; i++) {
    const r = make(p, makeRng("solo" + i), emptyRecent());
    assert.ok(!r.used.oddActors.includes("Solo Actor"));
  }
});

test("an actor billed below the first 5 names does not count those series", () => {
  const series = withActors(["Deep Actor"], [1, 2]);
  const s3 = series.find((s) => s.tmdbId === 3);
  s3.cast = [...s3.cast.slice(0, 5), { name: "Deep Actor", photo: null }, ...s3.cast.slice(5)];
  const p = buildPool(series, { known: 60 });
  assert.equal(billing(p.byId.get(3), "Deep Actor"), 5);
  for (let i = 0; i < 30; i++) {
    const r = make(p, makeRng("deep" + i), emptyRecent());
    assert.ok(!r.used.oddActors.includes("Deep Actor"));
  }
  assert.equal(make(p, makeRng("deep"), onlyRecentExcept(p, ["Deep Actor"])), null);
});

test("an actor with 2 top-600 + 1 other lead series is chosen and the other one appears", () => {
  const stars = ["Star A", "Star B", "Star C"];
  const p = narrowWide(buildPool(withActors(stars, [1, 2, 60]), { known: 58 }), [60]);
  assert.ok(!p.knownIds.has(60));
  const r = make(p, makeRng("star"), onlyRecentExcept(p, stars));
  assert.deepEqual([...r.used.oddActors].sort(), stars);
  for (const round of r.puzzle.rounds) {
    assert.ok(round.series.some((c) => c.id === 60));
    assert.ok(p.knownIds.has(round.series[round.odd].id));
  }
});

test("the three series are the actor's most-voted lead series, not a higher-voted minor role", () => {
  const series = withActors(["Lead A", "Lead B", "Lead C"], [10, 20, 30, 40]);
  // A minor role in series 1 (the most voted): it must not be shown, and is not an impostor.
  const s1 = series.find((s) => s.tmdbId === 1);
  for (const n of ["Lead A", "Lead B", "Lead C"]) s1.cast.push({ name: n, photo: null });
  const p = buildPool(series, { known: 60 });
  const r = make(p, makeRng("top"), onlyRecentExcept(p, ["Lead A", "Lead B", "Lead C"]));
  for (const round of r.puzzle.rounds) {
    const own = round.series.filter((_, k) => k !== round.odd).map((c) => c.id).sort((a, b) => a - b);
    assert.deepEqual(own, [10, 20, 30]);
    assert.notEqual(round.series[round.odd].id, 1);
  }
});
