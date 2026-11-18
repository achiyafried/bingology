// One scene, start to caption to actions. Shared by the recorder and the site test so they can't drift apart.

/** Closes anything a previous scene left open (a stuck card would cover every scene after it). */
async function closeDialogs(page) {
  await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach(d => d.close())).catch(() => {});
}

export async function playScene(page, scene, ctx) {
  await closeDialogs(page);
  if (scene.goto !== undefined) await page.goto(ctx.url + scene.goto, { waitUntil: "load" });
  await ctx.caption(page, scene.caption, { accent: !!scene.accent });
  await scene.run(page, ctx);
}

/** Seconds into a scene before its narration starts (lets the caption land first). */
export const NARRATION_LEAD = 0.4;
const BREATH = 0.6;

/** How long a scene still holds after its actions: its dwell, or until its narration ends plus a breath. */
export function holdMs({ elapsedMs, dwell, narration }) {
  const untilVoiceEnds = narration ? Math.round((NARRATION_LEAD + narration + BREATH) * 1000) - elapsedMs : 0;
  return Math.max(dwell * 1000, untilVoiceEnds);
}
