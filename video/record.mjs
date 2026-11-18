// npm run video → video/out/bingology-tour.mp4: plays the scenes in a phone-sized browser and records them.
import { readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { missingInstall, INSTALL_HINT } from "./lib/preflight.mjs";

const problem = missingInstall();
if (problem) { console.error(problem); process.exit(1); }
const { chromium } = await import("playwright");
const { startServer } = await import("./lib/server.mjs");
const { toMp4, durationOf, audibleEnd } = await import("./lib/convert.mjs");
const { contextOptions } = await import("./lib/device.mjs");
const { overlayInitScript, caption, tap } = await import("./lib/overlay.mjs");
const { playScene, holdMs, NARRATION_LEAD } = await import("./lib/runner.mjs");
const { synth, VOICE } = await import("./lib/voice.mjs");
const { SCENES, OUTRO } = await import("./scenes.mjs");
const TOUR = [...SCENES, OUTRO];

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");
const OUT = join(HERE, "out");
const RAW = join(OUT, "raw");
// MUSIC=video/music.light.mp3 NAME=light npm run video → another take, saved as bingology-tour-light.mp4
const MP4 = join(OUT, `bingology-tour${process.env.NAME ? "-" + process.env.NAME : ""}.mp4`);
const VOICE_DIR = join(OUT, "voice");
const MUSIC = process.env.MUSIC ? resolve(process.env.INIT_CWD || process.cwd(), process.env.MUSIC) : join(HERE, "music.mp3"); // optional background track; not committed (see README)
const FINALE = 11; // seconds of the track's own ending that close the video, so its last hit lands on the end card


async function main() {
  if (!existsSync(chromium.executablePath())) { console.error("הדפדפן להקלטה (Chromium) לא מותקן. " + INSTALL_HINT); process.exit(1); }

  const data = JSON.parse(await readFile(join(SITE, "data.json"), "utf8"));
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });

  // Narration first, so each scene knows how long its voice runs and can wait for it.
  await rm(VOICE_DIR, { recursive: true, force: true });
  await mkdir(VOICE_DIR, { recursive: true });
  const voice = {};
  for (const scene of TOUR) {
    const file = join(VOICE_DIR, `${scene.id}.aiff`);
    if (scene.say && await synth(scene.say, file)) voice[scene.id] = { file, secs: (await durationOf(file)) || 0 };
  }
  if (!Object.keys(voice).length) console.warn(`⚠ אין קריינות: הקול ${VOICE} (macOS) לא זמין. הסרטון ייצא בלי קול.`);
  const clips = [];

  const server = await startServer(SITE);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(contextOptions(RAW));
    await context.addInitScript(overlayInitScript());
    const page = await context.newPage();
    const videoStart = Date.now(); // the recording starts with the page
    let current = "";
    const loudTap = async (p, sel, o = {}) => {
      const ok = await tap(p, sel, o);
      if (!ok && !o.optional) console.warn(`⚠ ${current}: לא נמצא ${sel}`);
      return ok;
    };
    const ctx = { url: server.url, tap: loudTap, caption, data };

    for (const scene of TOUR) {
      const t0 = Date.now();
      current = scene.id;
      const v = voice[scene.id];
      if (v) clips.push({ file: v.file, at: (t0 - videoStart) / 1000 + NARRATION_LEAD });
      try {
        await playScene(page, scene, ctx);
      } catch (e) {
        console.warn(`⚠ ${scene.id}: ${String(e?.message ?? e).split("\n")[0]}`);
        await caption(page, scene.caption, { accent: !!scene.accent }).catch(() => {});
      }
      await page.waitForTimeout(holdMs({ elapsedMs: Date.now() - t0, dwell: scene.dwell, narration: v?.secs || 0 }));
      console.log(`✓ ${scene.id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }

    const video = page.video();
    await context.close(); // finishes writing the WebM
    const raw = await video.path();
    const music = existsSync(MUSIC)
      ? { file: MUSIC, duration: (await durationOf(raw)) || 0, finale: { end: await audibleEnd(MUSIC), length: FINALE } }
      : null;
    if (!music) console.log("(אין video/music.mp3, אז הסרטון ייצא בלי מוזיקת רקע)");
    await toMp4(raw, MP4, clips, music?.duration ? music : null);
    await rm(RAW, { recursive: true, force: true });
    await rm(VOICE_DIR, { recursive: true, force: true });
    const secs = await durationOf(MP4);
    console.log(`\nהסרטון מוכן: ${MP4}${secs ? ` (${secs.toFixed(1)} שניות)` : ""}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
