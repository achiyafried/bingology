import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLegacy } from "../scripts/lib/legacy.mjs";

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
