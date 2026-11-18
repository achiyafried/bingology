import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { overlayInitScript, caption, tap } from "../lib/overlay.mjs";

let browser, page;
before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.addInitScript(overlayInitScript());
  // A real navigation (not setContent), so the init script runs the way it does on the site.
  await page.goto("data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head></head><body><button id="b" style="margin-top:200px" onclick="window.hit=1">x</button></body></html>`));
});
after(() => browser?.close());

const box = () => page.locator("#tour-caption");

test("caption shows the text", async () => {
  await caption(page, "שלום");
  await assert.doesNotReject(box().getByText("שלום").waitFor({ state: "visible", timeout: 2000 }));
});
test("accent caption is marked", async () => {
  await caption(page, "x", { accent: true });
  assert.equal(await box().getAttribute("data-accent"), "true");
});
test("plain caption after an accent one is not marked", async () => {
  await caption(page, "y");
  assert.equal(await box().getAttribute("data-accent"), "false");
});
test("empty caption hides the bar", async () => {
  await caption(page, "");
  await assert.doesNotReject(box().waitFor({ state: "hidden", timeout: 2000 }));
});
test("tap clicks a visible element and reports it", async () => {
  assert.equal(await tap(page, "#b"), true);
  assert.equal(await page.evaluate(() => window.hit), 1);
});
test("tap on a missing element returns false instead of throwing", async () => {
  assert.equal(await tap(page, "#nope", { timeout: 300 }), false);
});
test("the overlay never blocks clicks", async () => {
  await caption(page, "z");
  const pe = await page.evaluate(() => getComputedStyle(document.getElementById("tour-overlay")).pointerEvents);
  assert.equal(pe, "none");
});
