import { test } from "node:test";
import assert from "node:assert/strict";
import { contextOptions } from "../lib/device.mjs";

// Playwright records at the page's CSS size and never scales up; a bigger frame leaves 3/4 of it grey.
test("the recording frame is exactly the phone viewport", () => {
  const o = contextOptions("/tmp/raw");
  assert.deepEqual(o.recordVideo.size, o.viewport);
  assert.deepEqual(o.viewport, { width: 390, height: 844 });
  assert.equal(o.recordVideo.dir, "/tmp/raw");
});
test("phone emulation in Hebrew, Israel time", () => {
  const o = contextOptions("/tmp/raw");
  assert.equal(o.isMobile, true);
  assert.equal(o.hasTouch, true);
  assert.equal(o.locale, "he-IL");
  assert.equal(o.timezoneId, "Asia/Jerusalem");
});
