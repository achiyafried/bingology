import { test } from "node:test";
import assert from "node:assert/strict";
import { validKey, embedUrl, playerHTML, tilePlayHTML, trailBtnHTML, searchLinkHTML, unavailableHTML, ytErrorCode, YT_ORIGINS } from "../site/lib/trailer.js";

const K = "dQw4w9WgXcQ";

test("validKey accepts only 11-char YouTube ids", () => {
  assert.equal(validKey(K), true);
  for (const bad of ["", null, undefined, "abc", 'x"onload=1', "dQw4w9WgXc?", 12345678901]) assert.equal(validKey(bad), false, String(bad));
});

test("embedUrl is the privacy-enhanced autoplay embed that stays in-page on iPhone", () => {
  assert.equal(embedUrl(K), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1");
});

test("embedUrl with an origin turns on the JS API so the site hears playback errors", () => {
  const u = new URL(embedUrl(K, "https://achiyafried.github.io"));
  assert.equal(u.searchParams.get("enablejsapi"), "1");
  assert.equal(u.searchParams.get("origin"), "https://achiyafried.github.io");
  assert.equal(u.searchParams.get("playsinline"), "1");
});

test("playerHTML embeds the key with an escaped title and the series index; nothing for a bad key", () => {
  const h = playerHTML(K, 'A <b>"x"</b>', 4);
  assert.match(h, /^<div class="tvid" data-i="4">/);
  assert.match(h, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1&rel=0&playsinline=1"/);
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

test("searchLinkHTML: today's YouTube search row (Hebrew names search in Hebrew)", () => {
  const en = searchLinkHTML({ n: "Dark" });
  assert.match(en, /^<div class="trail"><a href="https:\/\/www\.youtube\.com\/results\?search_query=Dark%20TV%20series%20official%20trailer"/);
  assert.match(en, /data-a="copylink"/);
  assert.match(searchLinkHTML({ n: "שטיסל" }), /search_query=%D7%A9/);
});

test("unavailableHTML says so and offers the search link", () => {
  const h = unavailableHTML({ n: "Dark" });
  assert.match(h, /הטריילר לא זמין לצפייה כאן/);
  assert.match(h, /search_query=Dark/);
});

test("ytErrorCode reads onError messages from the player, string or object", () => {
  assert.equal(ytErrorCode('{"event":"onError","info":150,"id":1,"channel":"widget"}'), 150);
  assert.equal(ytErrorCode({ event: "onError", info: 100 }), 100);
  assert.equal(ytErrorCode('{"event":"onStateChange","info":1}'), null);
  assert.equal(ytErrorCode("not json"), null);
  assert.equal(ytErrorCode(null), null);
  assert.ok(YT_ORIGINS.includes("https://www.youtube-nocookie.com"));
});
