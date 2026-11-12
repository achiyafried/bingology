import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../scripts/lib/games/rng.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { make, shortestActors } from "../scripts/lib/games/chain.mjs";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const pool = () => buildPool(fixtureSeries(), { known: 60 });

// Every series reachable by legal moves within `limit` actors, using only puzzle.series.
function walk(puzzle) {
  const { series, from, limit } = puzzle;
  const seen = new Set([String(from)]);
  let frontier = [String(from)];
  for (let step = 0; step < limit; step++) {
    const next = [];
    for (const id of frontier) {
      assert.ok(series[id], `series ${id} missing from puzzle.series`);
      for (const actor of series[id].cast) {
        for (const [oid, o] of Object.entries(series)) {
          if (o.cast.includes(actor) && !seen.has(oid)) {
            seen.add(oid);
            next.push(oid);
          }
        }
      }
    }
    frontier = next;
  }
  for (const id of frontier) assert.ok(series[id]);
  return seen;
}

test("deterministic for the same seed", () => {
  assert.deepEqual(make(pool(), makeRng("s"), emptyRecent()), make(pool(), makeRng("s"), emptyRecent()));
});

test("shortest is 2 or 3 and matches shortestActors; limit = shortest + 2", () => {
  const p = pool();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const { puzzle } = make(p, makeRng("c" + i), emptyRecent());
    seen.add(puzzle.shortest);
    assert.ok(puzzle.shortest === 2 || puzzle.shortest === 3);
    assert.equal(shortestActors(puzzle.series, puzzle.from, puzzle.to), puzzle.shortest);
    assert.equal(puzzle.limit, puzzle.shortest + 2);
    assert.ok(p.knownIds.has(puzzle.from) && p.knownIds.has(puzzle.to));
  }
  assert.deepEqual([...seen].sort(), [2, 3]);
});

test("series map is complete within limit, minimal beyond, and reaches the target", () => {
  const p = pool();
  for (let i = 0; i < 20; i++) {
    const { puzzle } = make(p, makeRng("k" + i), emptyRecent());
    const reached = walk(puzzle);
    assert.ok(reached.has(String(puzzle.to)));
    assert.equal(reached.size, Object.keys(puzzle.series).length, "nothing beyond the radius");
    for (const id of Object.keys(puzzle.series)) {
      const s = p.byId.get(Number(id));
      assert.ok(p.knownIds.has(Number(id)));
      assert.equal(puzzle.series[id].name, s.name);
      const names = [...new Set(s.cast.map((c) => c.name))];
      assert.deepEqual(puzzle.series[id].cast, names);
    }
    // limit is generous: every known series reachable within limit is present
    const full = Object.fromEntries(p.known.map((s) => [s.tmdbId, { cast: [...new Set(s.cast.map((c) => c.name))] }]));
    for (const s of p.known) {
      const d = shortestActors(full, puzzle.from, s.tmdbId);
      assert.equal(d <= puzzle.limit, String(s.tmdbId) in puzzle.series);
    }
  }
});

test("pair recorded sorted and avoided when recent", () => {
  const p = pool();
  const r = make(p, makeRng("x"), emptyRecent());
  const { from, to } = r.puzzle;
  assert.deepEqual(r.used, { pairs: [`${Math.min(from, to)}-${Math.max(from, to)}`] });
  const recent = emptyRecent();
  for (let i = 0; i < 30; i++) {
    const m = make(p, makeRng("r" + i), recent);
    assert.ok(!recent.pairs.has(m.used.pairs[0]));
    recent.pairs.add(m.used.pairs[0]);
  }
});

test("null when no pair at distance 2-3", () => {
  const tiny = buildPool(
    [
      { tmdbId: 1, name: "A", tmdbVotes: 3, cast: [{ name: "x" }] },
      { tmdbId: 2, name: "B", tmdbVotes: 2, cast: [{ name: "x" }] },
      { tmdbId: 3, name: "C", tmdbVotes: 1, cast: [{ name: "z" }] },
    ],
    { known: 3 },
  );
  assert.equal(make(tiny, makeRng("t"), emptyRecent()), null);
  assert.equal(make(buildPool([], { known: 3 }), makeRng("t"), emptyRecent()), null);
});

test("shortestActors: shared actor = 1, unreachable = Infinity", () => {
  const m = {
    1: { cast: ["a"] },
    2: { cast: ["a", "b"] },
    3: { cast: ["b"] },
    4: { cast: ["q"] },
  };
  assert.equal(shortestActors(m, 1, 2), 1);
  assert.equal(shortestActors(m, "1", "3"), 2);
  assert.equal(shortestActors(m, 1, 4), Infinity);
});
