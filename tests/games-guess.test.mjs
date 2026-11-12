import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../scripts/lib/games/rng.mjs";
import { buildPool, emptyRecent } from "../scripts/lib/games/pool.mjs";
import { make } from "../scripts/lib/games/guess.mjs";
import { fixtureSeries } from "./lib/games-fixture.mjs";

const ORDER = ["genreYear", "langSeasons", "creators", "actor", "overview", "poster"];
const pool = () => buildPool(fixtureSeries(), { known: 30 });

test("deterministic for the same seed", () => {
  assert.deepEqual(make(pool(), makeRng("s"), emptyRecent()), make(pool(), makeRng("s"), emptyRecent()));
});

test("answer is known and not recent; clues in order", () => {
  const p = pool();
  const recent = emptyRecent();
  for (const s of p.known.slice(0, 10)) recent.series.add(s.tmdbId);
  for (let i = 0; i < 20; i++) {
    const r = make(p, makeRng("k" + i), recent);
    assert.ok(p.knownIds.has(r.puzzle.answer.id));
    assert.ok(!recent.series.has(r.puzzle.answer.id));
    assert.deepEqual(r.used, { series: [r.puzzle.answer.id] });
    const kinds = r.puzzle.clues.map((c) => c.kind);
    assert.ok(kinds.length >= 5);
    assert.deepEqual(kinds, ORDER.filter((k) => kinds.includes(k)));
  }
});

test("clue texts and masked overview", () => {
  const p = pool();
  const r = make(p, makeRng("t"), emptyRecent());
  const s = p.byId.get(r.puzzle.answer.id);
  const by = Object.fromEntries(r.puzzle.clues.map((c) => [c.kind, c]));
  assert.match(by.genreYear.text, new RegExp(` · ${s.year}$`));
  assert.match(by.langSeasons.text, /עונה אחת$|עונות$/);
  assert.equal(by.creators.text, "יוצרים: " + s.creators.join(", "));
  assert.equal(by.actor.text, "בכיכוב " + s.cast[0].name);
  assert.equal(by.poster.img, s.poster);
  const ov = by.overview.text.toLowerCase();
  for (const n of [s.name, ...s.cast.map((c) => c.name), ...s.creators]) assert.ok(!ov.includes(n.toLowerCase()));
});

test("masks names and truncates at a word boundary", () => {
  const series = fixtureSeries();
  series[0].overviewHe = "Hub1 Actor " + "מילה ".repeat(80) + "Series 1";
  series[0].cast[0].name = "Hub1 Actor";
  const p = buildPool(series, { known: 1 });
  const r = make(p, makeRng("x"), emptyRecent());
  const t = r.puzzle.clues.find((c) => c.kind === "overview").text;
  assert.ok(t.startsWith("███ "));
  assert.ok(t.endsWith("…") && t.length <= 221);
  assert.ok(!t.slice(0, -1).endsWith(" "));
});

test("null when everything is recent, or pool empty", () => {
  const p = pool();
  const recent = emptyRecent();
  for (const s of p.known) recent.series.add(s.tmdbId);
  assert.equal(make(p, makeRng("a"), recent), null);
  assert.equal(make(buildPool([]), makeRng("a"), emptyRecent()), null);
});

test("series with fewer than 5 clues are skipped", () => {
  const series = fixtureSeries().slice(0, 3);
  for (const s of series) { delete s.creators; delete s.poster; }
  assert.equal(make(buildPool(series), makeRng("a"), emptyRecent()), null);
});
