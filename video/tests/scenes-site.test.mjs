// Plays every scene against the real site with a strict tap: a selector that isn't there fails the test
// (the recorder would only warn). Slow-ish (~40s) but it's the only thing that proves the scenes still fit the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../lib/server.mjs";
import { contextOptions } from "../lib/device.mjs";
import { overlayInitScript, caption, tap } from "../lib/overlay.mjs";
import { playScene } from "../lib/runner.mjs";
import { SCENES } from "../scenes.mjs";

const SITE = fileURLToPath(new URL("../../site/", import.meta.url));

test("every scene finds what it taps on the real site", { timeout: 180000 }, async () => {
  const server = await startServer(SITE);
  const browser = await chromium.launch();
  const failures = [];
  try {
    const { recordVideo, ...opts } = contextOptions("");
    const context = await browser.newContext(opts);
    await context.addInitScript(overlayInitScript());
    const page = await context.newPage();
    const strictTap = async (p, sel, o = {}) => {
      const ok = await tap(p, sel, o);
      if (!ok && !o.optional) throw new Error(`missing ${sel}`);
      return ok;
    };
    const data = JSON.parse(await readFile(SITE + "data.json", "utf8"));
    for (const scene of SCENES) {
      try { await playScene(page, scene, { url: server.url, tap: strictTap, caption, data }); }
      catch (e) { failures.push(`${scene.id}: ${e.message.split("\n")[0]}`); }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  assert.deepEqual(failures, []);
});
