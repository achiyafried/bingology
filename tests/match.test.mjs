import { test } from "node:test";
import assert from "node:assert/strict";
import { pickMatch, needsMatch } from "../scripts/lib/match.mjs";
import { tmdbGet } from "../scripts/lib/api.mjs";

const r = (id, name, date, original_name = name) => ({ id, name, original_name, first_air_date: date });

test("single result in the wanted year is picked", () => {
  assert.deepEqual(pickMatch([r(1396, "Breaking Bad", "2008-01-20"), r(5, "Breaking Bad: x", "2019-01-01")], { name: "Breaking Bad", year: 2008 }), { id: 1396 });
});

test("two results in the wanted year need review", () => {
  const res = [r(2316, "The Office", "2005-03-24"), r(9999, "The Office", "2005-09-01"), r(2996, "The Office", "2001-07-09")];
  const out = pickMatch(res, { name: "The Office", year: 2005 });
  assert.deepEqual(out.candidates.map(c => c.id), [2316, 9999]);
});

test("no results need review with no candidates", () => {
  assert.deepEqual(pickMatch([], { name: "X", year: 2000 }), { candidates: [] });
});

test("year off by one is accepted when exactly one exact-name result exists", () => {
  assert.deepEqual(pickMatch([r(7, "the pitt", "2025-01-09"), r(8, "Pitt Stop", "2024-05-01")], { name: "The Pitt", year: 2024 }), { id: 7 });
});

test("tmdbGet sends bearer token and query, returns JSON", async () => {
  process.env.TMDB_TOKEN = "tok";
  let seen;
  const fake = async (url, opts) => { seen = { url: String(url), opts }; return new Response(JSON.stringify({ ok: 1 }), { status: 200 }); };
  const out = await tmdbGet("/search/tv", { query: "a b" }, fake);
  assert.deepEqual(out, { ok: 1 });
  assert.equal(seen.url, "https://api.themoviedb.org/3/search/tv?query=a+b");
  assert.equal(seen.opts.headers.Authorization, "Bearer tok");
});

test("tmdbGet throws with status on 404", async () => {
  const fake = async () => new Response("{}", { status: 404 });
  await assert.rejects(tmdbGet("/tv/1", {}, fake), e => e.status === 404);
});

test("tmdbGet retries once after 429", async () => {
  let n = 0;
  const fake = async () => (++n === 1 ? new Response("{}", { status: 429, headers: { "Retry-After": "0" } }) : new Response('{"x":1}', { status: 200 }));
  assert.deepEqual(await tmdbGet("/tv/1", {}, fake), { x: 1 });
  assert.equal(n, 2);
});

test("placeholder (negative) and missing ids still need matching", () => {
  assert.equal(needsMatch({ tmdbId: null }), true);
  assert.equal(needsMatch({ tmdbId: -3 }), true);
  assert.equal(needsMatch({ tmdbId: 1396 }), false);
});
