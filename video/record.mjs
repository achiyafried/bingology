// npm run video → video/out/bingology-tour.mp4: plays the scenes in a phone-sized browser and records them.
import { existsSync } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { startServer } from "./lib/server.mjs";
import { toMp4, durationOf } from "./lib/convert.mjs";
import { contextOptions } from "./lib/device.mjs";
import { overlayInitScript, caption, tap } from "./lib/overlay.mjs";
import { SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");
const OUT = join(HERE, "out");
const RAW = join(OUT, "raw");
const MP4 = join(OUT, "bingology-tour.mp4");
const INSTALL = "הריצו קודם: npm --prefix video install";

function preflight() {
  if (!ffmpegPath || !existsSync(ffmpegPath)) return "ffmpeg לא נמצא. " + INSTALL;
  if (!existsSync(chromium.executablePath())) return "הדפדפן להקלטה (Chromium) לא מותקן. " + INSTALL;
  return null;
}

async function main() {
  const problem = preflight();
  if (problem) { console.error(problem); process.exit(1); }

  const data = JSON.parse(await readFile(join(SITE, "data.json"), "utf8"));
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });
  const server = await startServer(SITE);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(contextOptions(RAW));
    await context.addInitScript(overlayInitScript());
    const page = await context.newPage();
    const ctx = { url: server.url, tap, caption, data };

    for (const scene of SCENES) {
      const t0 = Date.now();
      try {
        if (scene.goto !== undefined) await page.goto(server.url + scene.goto, { waitUntil: "load" });
        await caption(page, scene.caption, { accent: !!scene.accent });
        await scene.run(page, ctx);
      } catch (e) {
        console.warn(`⚠ ${scene.id}: ${e.message.split("\n")[0]}`);
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
