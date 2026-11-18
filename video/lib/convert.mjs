// Turns Playwright's WebM recording into an MP4 that plays everywhere (WhatsApp, iPhone).
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

export const NO_FFMPEG = "ffmpeg לא נמצא — הריצו npm --prefix video install";

const VIDEO = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

/** `clips`: narration files, each placed `at` seconds into the video. None → a silent MP4. */
export function ffmpegArgs(input, output, clips = []) {
  if (!clips.length) return ["-y", "-i", input, "-an", ...VIDEO, output];
  const delays = clips.map((c, i) => { const ms = Math.round(c.at * 1000); return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`; });
  const mix = clips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${clips.length}:normalize=0[aout]`;
  return ["-y", "-i", input, ...clips.flatMap(c => ["-i", c.file]),
    "-filter_complex", [...delays, mix].join(";"), "-map", "0:v", "-map", "[aout]",
    ...VIDEO, "-c:a", "aac", "-b:a", "128k", output];
}

/** Runs ffmpeg; resolves { code, stderr }. Only a missing binary rejects. */
const run = args => new Promise((ok, fail) => {
  if (!ffmpegPath || !existsSync(ffmpegPath)) return fail(new Error(NO_FFMPEG));
  execFile(ffmpegPath, args, { maxBuffer: 1 << 26 }, (err, _out, stderr) => ok({ code: err ? err.code : 0, stderr }));
});

export async function toMp4(input, output, clips = []) {
  const r = await run(ffmpegArgs(input, output, clips));
  if (r.code !== 0) throw new Error("ההמרה ל-MP4 נכשלה:\n" + r.stderr.split("\n").slice(-5).join("\n"));
}

/** Length in seconds, read from ffmpeg's own report on the file. */
export async function durationOf(file) {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec((await run(["-i", file])).stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}
