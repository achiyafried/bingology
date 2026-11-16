import { test } from "node:test";
import assert from "node:assert/strict";
import { validKey, embedUrl, playerHTML, tilePlayHTML, trailBtnHTML } from "../site/lib/trailer.js";

const K = "dQw4w9WgXcQ";

test("validKey accepts only 11-char YouTube ids", () => {
  assert.equal(validKey(K), true);
  for (const bad of ["", null, undefined, "abc", 'x"onload=1', "dQw4w9WgXc?", 12345678901]) assert.equal(validKey(bad), false, String(bad));
});

test("embedUrl is the privacy-enhanced autoplay embed that stays in-page on iPhone", () => {
  assert.equal(embedUrl(K), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1");
});

test("playerHTML embeds the key with an escaped title; nothing for a bad key", () => {
  const h = playerHTML(K, 'A <b>"x"</b>');
  assert.match(h, /^<div class="tvid"><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1&rel=0&playsinline=1"/);
  assert.match(h, /title="טריילר: A &lt;b&gt;&quot;x&quot;&lt;\/b&gt;"/);
  assert.equal(playerHTML("bad", "A"), "");
});

test("tilePlayHTML: a ▶ only for a valid trailer, with an escaped label", () => {
  assert.equal(tilePlayHTML({ n: "A", tr: null }, 3), "");
  assert.equal(tilePlayHTML({ n: "A", tr: "bad key" }, 3), "");
  const h = tilePlayHTML({ n: "A&B", tr: K }, 3);
  assert.match(h, /^<button class="tplay" data-a="play" data-i="3" aria-label="טריילר: A&amp;B">/);
});

test("trailBtnHTML: an in-place play button, or null so the caller keeps the search link", () => {
  assert.equal(trailBtnHTML({ n: "A", tr: null }, 1), null);
  assert.match(trailBtnHTML({ n: "A", tr: K }, 1), /<button class="tbtn" data-a="trail" data-i="1">.*צפייה בטריילר<\/button>/);
});
