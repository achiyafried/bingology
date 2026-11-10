import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, safeImg } from "../site/lib/esc.js";

test("esc neutralizes HTML in third-party text", () => {
  assert.equal(esc(`<img src=x onerror="alert(1)">'&`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;");
  assert.equal(esc(null), "");
});

test("safeImg only allows TMDB image URLs", () => {
  assert.equal(safeImg("https://image.tmdb.org/t/p/w342/abc.jpg"), "https://image.tmdb.org/t/p/w342/abc.jpg");
  assert.equal(safeImg('https://image.tmdb.org/t/p/w342/a" onerror="x.jpg'), null);
  assert.equal(safeImg("javascript:alert(1)"), null);
  assert.equal(safeImg(null), null);
});
