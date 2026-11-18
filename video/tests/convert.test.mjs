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
