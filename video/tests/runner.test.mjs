import { test } from "node:test";
import assert from "node:assert/strict";
import { holdMs, NARRATION_LEAD } from "../lib/runner.mjs";

test("a scene holds its dwell when there's no narration", () => {
  assert.equal(holdMs({ elapsedMs: 5000, dwell: 4, narration: 0 }), 4000);
});
test("a scene waits until its narration ends, plus a short breath", () => {
  // narration starts NARRATION_LEAD s into the scene, lasts 9s; 3s of actions already passed
  const ms = holdMs({ elapsedMs: 3000, dwell: 2, narration: 9 });
  assert.equal(ms, Math.round((NARRATION_LEAD + 9 + 0.6) * 1000) - 3000);
});
test("long actions don't add extra waiting beyond the dwell", () => {
  assert.equal(holdMs({ elapsedMs: 20000, dwell: 3, narration: 5 }), 3000);
});
