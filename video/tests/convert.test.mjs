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
import { toMp4, durationOf } from "../lib/convert.mjs";

test("a 2-second clip converts to mp4 and reports about 2 seconds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tour-conv-"));
  const webm = join(dir, "in.webm"), mp4 = join(dir, "out.mp4");
  execFileSync(ffmpegPath, ["-v", "quiet", "-f", "lavfi", "-i", "testsrc=duration=2:size=64x64:rate=10", "-c:v", "libvpx", webm]);
  await toMp4(webm, mp4);
  const secs = await durationOf(mp4);
  assert.ok(Math.abs(secs - 2) < 0.3, `got ${secs}`);
});
