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

// Hit-testing can't tell (a modal makes everything outside it inert), so compare pixels: if the caption is on
// top, the caption area looks different with the caption shown than with it hidden.
test("the caption stays on top of a modal dialog opened after it", async () => {
  await page.evaluate(() => {
    const d = document.createElement("dialog");
    d.style.cssText = "width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;background:red";
    document.body.appendChild(d);
  });
  await caption(page, "מעל הדיאלוג");
  await page.evaluate(() => document.querySelector("dialog").showModal()); // opened after the caption
  await page.waitForTimeout(400);
  const clip = await page.locator("#tour-caption").boundingBox();
  const shown = await page.screenshot({ clip, animations: "disabled" });
  await caption(page, "");
  const hidden = await page.screenshot({ clip, animations: "disabled" });
  await page.evaluate(() => document.querySelector("dialog").close());
  assert.notDeepEqual(shown, hidden);
});
