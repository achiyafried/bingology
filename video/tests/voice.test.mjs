import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sayArgs, synth, VOICE } from "../lib/voice.mjs";
import { durationOf } from "../lib/convert.mjs";

test("narration uses the English voice Samantha", () => {
  assert.equal(VOICE, "Samantha");
  const a = sayArgs("Hello", "/tmp/x.aiff");
  assert.deepEqual(a.slice(0, 2), ["-v", "Samantha"]);
  assert.ok(a.includes("-o") && a[a.indexOf("-o") + 1] === "/tmp/x.aiff");
  assert.ok(a.at(-1).endsWith("Hello"));
});
test("the narrator sounds joyful: higher pitch, livelier intonation, quicker pace", () => {
  const a = sayArgs("Hello", "/tmp/x.aiff");
  assert.match(a.at(-1), /^\[\[pbas \+\d+\]\]\[\[pmod \+\d+\]\]Hello$/);
  assert.ok(+a[a.indexOf("-r") + 1] >= 195);
});
test("synth writes a playable clip", { skip: process.platform !== "darwin" && "macOS only" }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "tour-voice-")), "a.aiff");
  assert.equal(await synth("Hello everyone", out), true);
  assert.ok(existsSync(out));
  assert.ok((await durationOf(out)) > 0.4);
});
test("synth reports false instead of throwing when the voice can't run", async () => {
  assert.equal(await synth("Hello", "/nonexistent-dir/x.aiff"), false);
});
