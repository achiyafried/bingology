import { test } from "node:test";
import assert from "node:assert/strict";
import { hebKey, latKey } from "../site/lib/phonetic.js";
import { searchSeries } from "../site/lib/search.js";

test("Hebrew and Latin spellings reduce to the same consonant skeleton", () => {
  assert.deepEqual(hebKey("ברייקינג"), latKey("breaking"));
  assert.deepEqual(hebKey("סופרנוס"), latKey("sopranos"));
  assert.deepEqual(hebKey("ריי רומנו"), latKey("Ray Romano"));
});

const S = ["Breaking Bad", "The Sopranos", "The Office (US)", "The Office (UK)", "שטיסל", "Better Call Saul"].map((n, i) => ({ n, bs: 90 - i }));
const names = (q) => searchSeries(S, q).map(i => S[i].n);

test("searchSeries finds by part of the English name, case-insensitive", () => {
  assert.deepEqual(names("office"), ["The Office (US)", "The Office (UK)"]);
  assert.deepEqual(names("BAD"), ["Breaking Bad"]);
});

test("searchSeries finds English names typed in Hebrew by pronunciation", () => {
  assert.deepEqual(names("ברייקינג"), ["Breaking Bad"]);
  assert.deepEqual(names("סופרנוס"), ["The Sopranos"]);
  assert.ok(names("אופיס").includes("The Office (US)"));
});

test("searchSeries finds Hebrew names, and ignores empty or one-letter queries", () => {
  assert.deepEqual(names("שטיסל"), ["שטיסל"]);
  assert.deepEqual(names(""), []);
  assert.deepEqual(names(" "), []);
});

test("exact-text matches come before phonetic ones, then by binge score", () => {
  const S2 = [{ n: "Lost", bs: 70 }, { n: "The Last of Us", bs: 95 }, { n: "Lost in Space", bs: 80 }];
  assert.deepEqual(searchSeries(S2, "lost").map(i => S2[i].n), ["Lost in Space", "Lost"]);
});
