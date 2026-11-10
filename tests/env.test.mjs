import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnv } from "../scripts/lib/env.mjs";

test("loadEnv reads KEY=value lines without overriding existing variables", () => {
  const dir = mkdtempSync(join(tmpdir(), "bingo-env-"));
  const f = join(dir, ".env");
  writeFileSync(f, "# keys\nBINGO_A=one\nBINGO_B = two \n\nBINGO_C=keep\n");
  process.env.BINGO_C = "already";
  loadEnv(f);
  assert.equal(process.env.BINGO_A, "one");
  assert.equal(process.env.BINGO_B, "two");
  assert.equal(process.env.BINGO_C, "already");
});

test("loadEnv ignores a missing file", () => {
  assert.doesNotThrow(() => loadEnv("/nonexistent/.env"));
});
