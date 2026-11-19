import { test } from "node:test";
import assert from "node:assert/strict";
import { validateKids, kidsLive, overCap, AGES, AGE_CAP } from "../scripts/lib/kids.mjs";

test("validateKids accepts good rows", () => {
  assert.deepEqual(validateKids([{ tmdb: 1, age: "small" }, { tmdb: 2, age: "big", he: "שם" }]), []);
});

test("validateKids names each bad row", () => {
  const errs = validateKids([
    { tmdb: 1, age: "mid" }, { tmdb: 1, age: "mid" }, // duplicate
    { tmdb: "3", age: "mid" },                        // tmdb not a number
    { tmdb: 4, age: "teen" },                         // unknown age
    { tmdb: 5, age: "mid", he: 5 },                   // he not text
    { tmdb: 6, age: "mid", he: "  " },                // he empty
  ]);
  for (const [i, re] of [[1, /duplicate/], [2, /tmdb/], [3, /age/], [4, /he/], [5, /he/]])
    assert.ok(errs.some(e => e.startsWith(`row ${i}:`) && re.test(e)), `row ${i} ${re}: ${errs.join(" | ")}`);
  assert.equal(validateKids("x").length, 1);
});

test("AGES and caps", () => {
  assert.deepEqual(AGES, ["small", "mid", "big"]);
  assert.deepEqual(AGE_CAP, { small: 7, mid: 10, big: 13 });
});

const map = { netflix: ["Netflix"], disney: ["Disney Plus"] };
const bluey = {
  id: 82728, name: "Bluey", poster_path: "/b.jpg", first_air_date: "2018-10-01", number_of_seasons: 3,
  overview: "EN bluey", vote_average: 8.66, vote_count: 10,
  content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-Y" }] },
  "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Disney Plus" }] } } },
};

test("kidsLive maps a TMDB show", () => {
  const x = kidsLive(bluey, { name: "בלואי", overview: "תקציר" }, map);
  assert.deepEqual(x, {
    name: "Bluey", nameHe: "בלואי", poster: "https://image.tmdb.org/t/p/w342/b.jpg",
    overview: "תקציר", overviewEn: "EN bluey", year: 2018, seasons: 3, vote: 8.7, minAge: 0,
    providers: ["disney"], providersGuess: [],
  });
});

test("kidsLive: no Hebrew, no poster, no votes", () => {
  const x = kidsLive({ id: 1, name: "X", poster_path: null, vote_count: 0, vote_average: 0, overview: "" }, null, map);
  assert.equal(x.nameHe, null);
  assert.equal(x.poster, null);
  assert.equal(x.vote, null);
  assert.equal(x.overview, null);
  assert.equal(x.overviewEn, null);
  assert.equal(x.year, null);
  assert.deepEqual(x.providers, []);
});

test("overCap", () => {
  assert.equal(overCap({ age: "small", minAge: 7 }), false);
  assert.equal(overCap({ age: "small", minAge: 10 }), true);
  assert.equal(overCap({ age: "big", minAge: null }), false);
  assert.equal(overCap({ age: "big", minAge: 14 }), true);
});
