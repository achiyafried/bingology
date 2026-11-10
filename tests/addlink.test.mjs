import { test } from "node:test";
import assert from "node:assert/strict";
import { addSeriesUrl } from "../site/lib/addlink.js";

test("addSeriesUrl opens the issue form with the searched name filled in", () => {
  const u = new URL(addSeriesUrl("achiyafried/bingology", "The Penguin & Co"));
  assert.equal(u.origin + u.pathname, "https://github.com/achiyafried/bingology/issues/new");
  assert.equal(u.searchParams.get("template"), "add-series.yml");
  assert.equal(u.searchParams.get("name"), "The Penguin & Co");
  assert.equal(u.searchParams.get("title"), "הוספת סדרה: The Penguin & Co");
});

test("addSeriesUrl without a name opens an empty form", () => {
  const u = new URL(addSeriesUrl("achiyafried/bingology", "  "));
  assert.equal(u.searchParams.get("name"), null);
  assert.equal(u.searchParams.get("title"), "הוספת סדרה");
});
