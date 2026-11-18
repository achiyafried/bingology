// Turns Playwright's WebM recording into an MP4 that plays everywhere (WhatsApp, iPhone).
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

export const NO_FFMPEG = "ffmpeg לא נמצא — הריצו npm --prefix video install";

const VIDEO = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

const MUSIC_VOLUME = 0.35, FADE_IN = 1.5, FADE_OUT = 2.5, CROSSFADE = 1.5;
const sec = n => +n.toFixed(2);

/** The music bed: either the track's opening crossfaded into its real ending (`finale`), or its opening faded out. */
function bedChain(input, d, finale) {
  const tail = `volume=${MUSIC_VOLUME}[bed]`;
  if (finale && finale.length + CROSSFADE < d) {
    const headLen = sec(d - finale.length + CROSSFADE), from = sec(finale.end - finale.length);
    return [`[${input}:a]asplit=2[ma][mb]`,
      `[ma]atrim=0:${headLen},asetpts=N/SR/TB,afade=t=in:d=${FADE_IN}[mhead]`,
      `[mb]atrim=${from}:${sec(finale.end)},asetpts=N/SR/TB[mend]`,
      `[mhead][mend]acrossfade=d=${CROSSFADE},${tail}`];
  }
  return [`[${input}:a]atrim=0:${d},asetpts=N/SR/TB,afade=t=in:d=${FADE_IN},afade=t=out:st=${sec(d - FADE_OUT)}:d=${FADE_OUT},${tail}`];
}

/**
 * `clips`: narration files, each placed `at` seconds into the video.
 * `music`: { file, duration, finale? } — a bed under everything, `duration` long (the video's length), pushed down
 * while the narrator speaks. With `finale: { end, length }` the last `length` seconds before `end` of the track
 * close the video (so it ends on the track's own ending); otherwise the bed just fades out. No clips and no music → a silent MP4.
 */
export function ffmpegArgs(input, output, clips = [], music = null) {
  if (!clips.length && !music) return ["-y", "-i", input, "-an", ...VIDEO, output];
  const graph = clips.map((c, i) => { const ms = Math.round(c.at * 1000); return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`; });
  if (clips.length) graph.push(clips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${clips.length}:normalize=0[voice]`);
  if (music) {
    graph.push(...bedChain(clips.length + 1, music.duration, music.finale));
    // The voice track is padded with silence: the ducking filter stops when its key input ends,
    // which would cut the music off after the last narration line.
    if (clips.length) graph.push("[voice]apad,asplit=2[vkey][vmix]",
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

/** Where a track's sound really ends (the start of its trailing silence), or its full length. */
export async function audibleEnd(file) {
  const { stderr } = await run(["-i", file, "-af", "silencedetect=noise=-30dB:d=0.3", "-f", "null", "-"]);
  const total = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  const len = total ? +total[1] * 3600 + +total[2] * 60 + +total[3] : null;
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const last = starts.at(-1);
  // trailing silence = a silence that starts after the last silence_end, or one that runs to the end of the file
  if (last != null && last > 0 && (ends.length < starts.length || (len && Math.abs(ends.at(-1) - len) < 0.5))) return last;
  return len;
}
