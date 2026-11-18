// npm run video → video/out/bingology-tour.mp4: plays the scenes in a phone-sized browser and records them.
import { readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { missingInstall, INSTALL_HINT } from "./lib/preflight.mjs";

const problem = missingInstall();
if (problem) { console.error(problem); process.exit(1); }
const { chromium } = await import("playwright");
const { startServer } = await import("./lib/server.mjs");
const { toMp4, durationOf } = await import("./lib/convert.mjs");
const { contextOptions } = await import("./lib/device.mjs");
const { overlayInitScript, caption, tap } = await import("./lib/overlay.mjs");
const { playScene } = await import("./lib/runner.mjs");
const { SCENES } = await import("./scenes.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");
const OUT = join(HERE, "out");
const RAW = join(OUT, "raw");
const MP4 = join(OUT, "bingology-tour.mp4");


async function main() {
  if (!existsSync(chromium.executablePath())) { console.error("הדפדפן להקלטה (Chromium) לא מותקן. " + INSTALL_HINT); process.exit(1); }

  const data = JSON.parse(await readFile(join(SITE, "data.json"), "utf8"));
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });
  const server = await startServer(SITE);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(contextOptions(RAW));
    await context.addInitScript(overlayInitScript());
    const page = await context.newPage();
    let current = "";
    const loudTap = async (p, sel, o = {}) => {
      const ok = await tap(p, sel, o);
      if (!ok && !o.optional) console.warn(`⚠ ${current}: לא נמצא ${sel}`);
      return ok;
    };
    const ctx = { url: server.url, tap: loudTap, caption, data };

    for (const scene of SCENES) {
      const t0 = Date.now();
      current = scene.id;
      try {
        await playScene(page, scene, ctx);
      } catch (e) {
        console.warn(`⚠ ${scene.id}: ${String(e?.message ?? e).split("\n")[0]}`);
        await caption(page, scene.caption, { accent: !!scene.accent }).catch(() => {});
      }
      await page.waitForTimeout(scene.dwell * 1000);
      console.log(`✓ ${scene.id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }

    const video = page.video();
    await context.close(); // finishes writing the WebM
    await toMp4(await video.path(), MP4);
    await rm(RAW, { recursive: true, force: true });
    const secs = await durationOf(MP4);
    console.log(`\nהסרטון מוכן: ${MP4}${secs ? ` (${secs.toFixed(1)} שניות)` : ""}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
