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
