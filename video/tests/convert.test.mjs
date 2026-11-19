import { test } from "node:test";
import assert from "node:assert/strict";
import { ffmpegArgs } from "../lib/convert.mjs";

test("ffmpeg args make a phone-friendly silent mp4", () => {
  const a = ffmpegArgs("in.webm", "out.mp4");
  const pair = (k, v) => a.some((x, i) => x === k && a[i + 1] === v);
  assert.ok(pair("-i", "in.webm"));
  assert.ok(pair("-c:v", "libx264"));
  assert.ok(pair("-pix_fmt", "yuv420p"));
  assert.ok(pair("-movflags", "+faststart"));
  assert.ok(a.includes("-y"));
  assert.ok(a.includes("-an"));
  assert.equal(a.at(-1), "out.mp4");
});

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { toMp4, durationOf, audibleEnd } from "../lib/convert.mjs";

test("a 2-second clip converts to mp4 and reports about 2 seconds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-conv-"));
  const webm = join(dir, "in.webm"), mp4 = join(dir, "out.mp4");
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "testsrc=duration=2:size=64x64:rate=10", "-c:v", "libvpx", webm]);
  await toMp4(webm, mp4);
  const secs = await durationOf(mp4);
  assert.ok(Math.abs(secs - 2) < 0.3, `got ${secs}`);
});

test("narration clips are delayed to their scene and mixed without lowering the volume", () => {
  const a = ffmpegArgs("in.webm", "out.mp4", [{ file: "a.aiff", at: 0.3 }, { file: "b.aiff", at: 12.25 }]);
  const pair = (k, v) => a.some((x, i) => x === k && a[i + 1] === v);
  assert.ok(pair("-i", "a.aiff") && pair("-i", "b.aiff"));
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[1:a\]adelay=300\|300/);
  assert.match(fc, /\[2:a\]adelay=12250\|12250/);
  assert.match(fc, /amix=inputs=2:normalize=0/);
  assert.ok(pair("-c:a", "aac"));
  assert.ok(!a.includes("-an"));
  assert.equal(a.at(-1), "out.mp4");
});
test("without clips the mp4 stays silent", () => {
  assert.ok(ffmpegArgs("in.webm", "out.mp4", []).includes("-an"));
});

const MUSIC = { file: "m.mp3", duration: 68 };
test("music plays under the narration and ducks while the narrator speaks", () => {
  const a = ffmpegArgs("in.webm", "out.mp4", [{ file: "a.aiff", at: 0.4 }], MUSIC);
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.ok(a.some((x, i) => x === "-i" && a[i + 1] === "m.mp3"));
  assert.match(fc, /\[2:a\]/); // music is the input after the narration clip
  assert.match(fc, /afade=t=in/);
  assert.match(fc, /afade=t=out:st=65\.5:d=2\.5/); // fades over the last 2.5s of a 68s video
  assert.match(fc, /atrim=0:68/);
  assert.match(fc, /sidechaincompress/);
  assert.ok(a.includes("[aout]"));
  assert.ok(!a.includes("-an"));
});
test("music without narration still plays, faded, with nothing to duck under", () => {
  const a = ffmpegArgs("in.webm", "out.mp4", [], MUSIC);
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[1:a\]/);
  assert.doesNotMatch(fc, /sidechaincompress/);
  assert.ok(a.includes("[aout]") && !a.includes("-an"));
});
test("a real mix with music and narration produces one audio track as long as the video", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-mix-"));
  const v = join(dir, "v.webm"), voice = join(dir, "voice.wav"), m = join(dir, "m.wav"), out = join(dir, "o.mp4");
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "testsrc=duration=4:size=64x64:rate=10", "-c:v", "libvpx", v]);
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=440:d=1", voice]);
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=220:d=10", m]);
  await toMp4(v, out, [{ file: voice, at: 1 }], { file: m, duration: 4 });
  const secs = await durationOf(out);
  assert.ok(Math.abs(secs - 4) < 0.3, `got ${secs}`);
});

test("with a finale, the music crossfades into the track's real ending so it lands on the video's last second", () => {
  const a = ffmpegArgs("in.webm", "out.mp4", [{ file: "a.aiff", at: 0.4 }], { file: "m.mp3", duration: 76, finale: { end: 106.2, length: 11 } });
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.match(fc, /\[2:a\]asplit=2\[ma\]\[mb\]/);
  assert.match(fc, /\[ma\]atrim=0:66\.5,/);          // 76 - 11 + 1.5s crossfade
  assert.match(fc, /\[mb\]atrim=95\.2:106\.2,/);     // the track's last 11 audible seconds
  assert.match(fc, /acrossfade=d=1\.5/);
  assert.doesNotMatch(fc, /afade=t=out:st=/);        // the track ends itself; no artificial fade-out
});
test("a finale longer than the video falls back to the plain fade-out", () => {
  const a = ffmpegArgs("in.webm", "out.mp4", [], { file: "m.mp3", duration: 8, finale: { end: 106.2, length: 11 } });
  const fc = a[a.indexOf("-filter_complex") + 1];
  assert.doesNotMatch(fc, /acrossfade/);
  assert.match(fc, /afade=t=out:st=5\.5/);
});
test("audibleEnd finds where a track's sound actually stops", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-end-"));
  const f = join(dir, "t.wav");
  // 2s of tone, then 2s of silence
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=440:d=2", "-af", "apad=pad_dur=2", f]);
  const end = await audibleEnd(f);
  assert.ok(Math.abs(end - 2) < 0.3, `got ${end}`);
});

test("the music keeps playing after the last narration line, to the end of the video", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-tail-"));
  const v = join(dir, "v.webm"), voice = join(dir, "voice.wav"), m = join(dir, "m.wav"), out = join(dir, "o.mp4"), aud = join(dir, "o.m4a");
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "testsrc=duration=6:size=64x64:rate=10", "-c:v", "libvpx", v]);
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=440:d=1", voice]); // voice ends at 2s
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=220:d=20", m]);
  await toMp4(v, out, [{ file: voice, at: 1 }], { file: m, duration: 6 });
  execFileSync(ffmpegPath, ["-v", "quiet", "-y", "-i", out, "-vn", "-c:a", "copy", aud]);
  const secs = await durationOf(aud);
  assert.ok(secs > 5.5, `audio stops at ${secs}s`);
});

test("a track shorter than the video loops, so the music lasts to the end (finale included)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-loop-"));
  const v = join(dir, "v.webm"), voice = join(dir, "voice.wav"), m = join(dir, "m.wav"), out = join(dir, "o.mp4"), aud = join(dir, "o.m4a");
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "testsrc=duration=12:size=64x64:rate=10", "-c:v", "libvpx", v]);
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=440:d=1", voice]);
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "sine=f=220:d=8", m]); // 8s track, 12s video
  await toMp4(v, out, [{ file: voice, at: 1 }], { file: m, duration: 12, finale: { end: 8, length: 3 } });
  execFileSync(ffmpegPath, ["-v", "quiet", "-y", "-i", out, "-vn", "-c:a", "copy", aud]);
  const secs = await durationOf(aud);
  assert.ok(secs > 11.5, `audio stops at ${secs}s`);
});
