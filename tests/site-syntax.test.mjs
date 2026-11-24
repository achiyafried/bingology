// Every browser script must at least parse: DOM-bound modules (app.js files) have no unit tests,
// so a stray "else" there would only show up as a blank page.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test("every site script parses", () => {
  const files = walk("site").filter(f => f.endsWith(".js"));
  assert.ok(files.length > 10);
  for (const f of files) {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
    catch (e) { assert.fail(`${f}: ${String(e.stderr).split("\n").slice(0, 5).join(" ")}`); }
  }
});
