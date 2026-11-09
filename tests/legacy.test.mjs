import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLegacy, legacyToSeries } from "../scripts/lib/legacy.mjs";

const html = readFileSync("legacy/bingology-artifact.html", "utf8");

test("parseLegacy extracts all legacy data tables", () => {
  const d = parseLegacy(html);
  assert.equal(d.RAW.length, 128);
  assert.equal(d.META.length, 128);
  assert.equal(d.RAW[2][0], "Breaking Bad");
  assert.equal(d.NYTR[2], 1);
  assert.equal(d.PRAISE.length, 128);
  assert.equal(d.MORE[2][0], "Vince Gilligan");
});

test("legacyToSeries maps legacy rows to curated entries", () => {
  const e = legacyToSeries(parseLegacy(html));
  assert.equal(e.length, 128);
  assert.deepEqual(e[2].lists, ["mine", "nyt"]);
  assert.equal(e[2].nytRank, 1);
  assert.deepEqual(e[60].lists, ["nyt"]);
  assert.deepEqual(e[2].fallback, { year: 2008, seasons: 5, episodes: 62, runtime: 47, imdb: 9.5, lang: "en" });
  assert.equal(e[2].rt, 96);
  assert.deepEqual(e[2].genres, ["crime", "thriller", "drama"]);
  assert.equal(e[0].solo, true);
  assert.equal(e[2].awards.length, 2);
  assert.equal(e[0].tmdbId, null);
  assert.equal(e[2].name, "Breaking Bad");
  assert.equal(e[2].year, 2008);
  assert.equal(e.filter(x => x.lists.includes("mine")).length, 60);
});
