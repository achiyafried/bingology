// Checked before anything imports Playwright or ffmpeg, so a fresh clone gets a clear message, not a stack trace.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

export const INSTALL_HINT = "הריצו קודם: npm --prefix video install";
const req = createRequire(import.meta.url);

/** Null when everything the recorder needs is installed; otherwise a Hebrew message saying what to run. */
export function missingInstall(resolve = req.resolve) {
  try {
    resolve("playwright");
    resolve("ffmpeg-static");
  } catch {
    return "הכלים להקלטת הסרטון לא מותקנים. " + INSTALL_HINT;
  }
  if (resolve === req.resolve) {
    const ffmpeg = req("ffmpeg-static");
    if (!ffmpeg || !existsSync(ffmpeg)) return "ffmpeg לא נמצא. " + INSTALL_HINT;
  }
  return null;
}
