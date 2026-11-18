import { test } from "node:test";
import assert from "node:assert/strict";
import { missingInstall } from "../lib/preflight.mjs";

test("a fresh clone without packages gets the Hebrew install hint", () => {
  const msg = missingInstall(() => { throw Object.assign(new Error("nope"), { code: "MODULE_NOT_FOUND" }); });
  assert.match(msg, /npm --prefix video install/);
});
test("installed packages pass", () => {
  assert.equal(missingInstall(), null);
});
