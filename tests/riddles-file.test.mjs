import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRiddles } from "../scripts/lib/games/riddles.mjs";

// riddles.json is written by hand: a broken row fails here, before it reaches the site.
test("riddles.json is valid against the site's series", () => {
  const riddles = JSON.parse(readFileSync("riddles.json", "utf8"));
  const ids = new Set(JSON.parse(readFileSync("site/data.json", "utf8")).series.map(s => s.tmdbId));
  assert.deepEqual(validateRiddles(riddles, ids), []);
});
