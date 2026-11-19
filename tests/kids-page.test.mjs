import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stampJs, unstamped } from "../scripts/stamp.mjs";

test("the main menu links to the kids page", () => {
  assert.match(readFileSync("site/app.js", "utf8"), /<a class="tab kids" href="kids\.html">/);
  assert.match(readFileSync("site/styles.css", "utf8"), /\.tab\.kids\s*\{/);
});

test("kids.html is RTL Hebrew and loads its own script and style", () => {
  const h = readFileSync("site/kids.html", "utf8");
  assert.match(h, /<html lang="he" dir="rtl"/);
  assert.match(h, /src="kids\/app\.js"/);
  assert.match(h, /href="kids\/kids\.css"/);
  assert.match(h, /<dialog id="kcard"/);
});

test("every kids module is cache-busted by the deploy stamp", () => {
  for (const f of readdirSync("site/kids").filter(f => f.endsWith(".js")))
    assert.deepEqual(unstamped(stampJs(readFileSync(`site/kids/${f}`, "utf8"), "abc")), [], f);
});
