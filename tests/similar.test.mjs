import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromData } from "../site/lib/data.js";
import { neighbours, similarity, crew } from "../site/lib/similar.js";

const S = fromData(JSON.parse(readFileSync("tests/fixtures/data-small.json", "utf8")));
const mk = (o = {}) => ({ creators: [], g: ["drama"], mo: [], h: 2, lang: "en", providers: [], y: 2010, imdb: 8, ...o });

test("neighbours excludes the series itself and is sorted by score", () => {
  const r = neighbours(S, 0, 10);
  assert.ok(r.length > 0);
  assert.ok(r.every(x => x.j !== 0));
  for (let k = 1; k < r.length; k++) assert.ok(r[k - 1].sc >= r[k].sc);
});

test("shared creator scores at least 4 and explains it", () => {
  const T = [mk({ creators: ["דן לוי (יוצר)"] }), mk({ creators: ["בהפקת דן לוי"] })];
  assert.deepEqual(crew(T[0]), ["דן לוי"]);
  assert.ok(similarity(T[0], T[1]).sc >= 4);
  const [x] = neighbours(T, 0, 4);
  assert.ok(x.sc >= 4);
  assert.ok(x.why.startsWith("מאותם יוצרים ("));
});

test("skip filters candidates", () => {
  const [top] = neighbours(S, 0, 10);
  const r = neighbours(S, 0, 10, j => j === top.j);
  assert.ok(r.every(x => x.j !== top.j));
});
