import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRiddles, unknownSeries } from "../scripts/lib/games/riddles.mjs";

// riddles.json is written by hand: a malformed row fails here, before it reaches the site.
// A series that is not on the site (yet, or any more) only warns: the pool changes nightly, and this
// test runs first in the nightly workflow, so it must not stop the data update.
test("riddles.json is well formed", () => {
  const riddles = JSON.parse(readFileSync("riddles.json", "utf8"));
  assert.deepEqual(validateRiddles(riddles), []);
  const ids = new Set(JSON.parse(readFileSync("site/data.json", "utf8")).series.map(s => s.tmdbId));
  for (const w of unknownSeries(riddles, ids)) console.warn("riddles.json:", w);
});
