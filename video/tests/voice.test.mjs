import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sayArgs, synth, VOICE } from "../lib/voice.mjs";
import { durationOf } from "../lib/convert.mjs";

test("narration uses the Hebrew voice Carmit", () => {
  assert.equal(VOICE, "Carmit");
  const a = sayArgs("שלום", "/tmp/x.aiff");
  assert.deepEqual(a.slice(0, 2), ["-v", "Carmit"]);
  assert.ok(a.includes("-o") && a[a.indexOf("-o") + 1] === "/tmp/x.aiff");
  assert.equal(a.at(-1), "שלום");
});
test("synth writes a playable clip", { skip: process.platform !== "darwin" && "macOS only" }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "tour-voice-")), "a.aiff");
  assert.equal(await synth("שלום לכולם", out), true);
  assert.ok(existsSync(out));
  assert.ok((await durationOf(out)) > 0.4);
});
test("synth reports false instead of throwing when the voice can't run", async () => {
  assert.equal(await synth("שלום", "/nonexistent-dir/x.aiff"), false);
});
