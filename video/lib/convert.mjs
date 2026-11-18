// Turns Playwright's WebM recording into an MP4 that plays everywhere (WhatsApp, iPhone).
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

export const NO_FFMPEG = "ffmpeg לא נמצא — הריצו npm --prefix video install";

const VIDEO = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

const MUSIC_VOLUME = 0.35, FADE_IN = 1.5, FADE_OUT = 2.5;

/**
 * `clips`: narration files, each placed `at` seconds into the video.
 * `music`: { file, duration } — a bed under everything, faded in and out, cut to `duration` (the video's length),
 * and pushed down while the narrator speaks. No clips and no music → a silent MP4.
 */
export function ffmpegArgs(input, output, clips = [], music = null) {
  if (!clips.length && !music) return ["-y", "-i", input, "-an", ...VIDEO, output];
  const graph = clips.map((c, i) => { const ms = Math.round(c.at * 1000); return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`; });
  if (clips.length) graph.push(clips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${clips.length}:normalize=0[voice]`);
  if (music) {
    const d = music.duration, m = clips.length + 1;
    graph.push(`[${m}:a]atrim=0:${d},asetpts=N/SR/TB,volume=${MUSIC_VOLUME},afade=t=in:d=${FADE_IN},afade=t=out:st=${+(d - FADE_OUT).toFixed(2)}:d=${FADE_OUT}[bed]`);
    if (clips.length) graph.push("[voice]asplit=2[vkey][vmix]",
      "[bed][vkey]sidechaincompress=threshold=0.02:ratio=10:attack=40:release=500[ducked]",
      "[ducked][vmix]amix=inputs=2:normalize=0:duration=first[aout]");
    else graph.push("[bed]anull[aout]");
  } else graph[graph.length - 1] = graph.at(-1).replace("[voice]", "[aout]");
  const inputs = [...clips.map(c => c.file), ...(music ? [music.file] : [])].flatMap(f => ["-i", f]);
  return ["-y", "-i", input, ...inputs, "-filter_complex", graph.join(";"), "-map", "0:v", "-map", "[aout]",
    ...VIDEO, "-c:a", "aac", "-b:a", "160k", output];
}

/** Runs ffmpeg; resolves { code, stderr }. Only a missing binary rejects. */
const run = args => new Promise((ok, fail) => {
  if (!ffmpegPath || !existsSync(ffmpegPath)) return fail(new Error(NO_FFMPEG));
  execFile(ffmpegPath, args, { maxBuffer: 1 << 26 }, (err, _out, stderr) => ok({ code: err ? err.code : 0, stderr }));
});

export async function toMp4(input, output, clips = [], music = null) {
  const r = await run(ffmpegArgs(input, output, clips, music));
  if (r.code !== 0) throw new Error("ההמרה ל-MP4 נכשלה:\n" + r.stderr.split("\n").slice(-5).join("\n"));
}

/** Length in seconds, read from ffmpeg's own report on the file. */
export async function durationOf(file) {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec((await run(["-i", file])).stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}
