import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, searchTerm } from "../scenes.mjs";

const MARVEL = "🌌 היקום של מארוול — מוקדש לעמליה ❤️";

test("scenes run in the agreed order", () => {
  assert.deepEqual(SCENES.map(s => s.id), ["home", "quiz", "card", "list", "search", "actors", "games", "marvel", "mine"]);
});
test("every scene has a caption and a run function", () => {
  for (const s of SCENES) {
    assert.ok(typeof s.caption === "string" && s.caption.length > 0, s.id);
    assert.equal(typeof s.run, "function", s.id);
  }
});
test("the Marvel scene is dedicated to Amalia, highlighted", () => {
  const m = SCENES.find(s => s.id === "marvel");
  assert.equal(m.caption, MARVEL);
  assert.equal(m.accent, true);
});
test("only the Marvel scene is highlighted", () => {
  assert.deepEqual(SCENES.filter(s => s.accent).map(s => s.id), ["marvel"]);
});
test("hold times leave room for a 60–90 second video", () => {
  const total = SCENES.reduce((a, s) => a + s.dwell, 0);
  assert.ok(total >= 35 && total <= 60, `total dwell ${total}`);
});
test("search term prefers a well-known show and falls back to the first one", () => {
  assert.equal(searchTerm({ series: [{ name: "X Show" }, { name: "Breaking Bad" }] }), "Break");
  assert.equal(searchTerm({ series: [{ name: "The Leftovers" }] }), "The L");
  assert.equal(searchTerm({ series: [] }), "");
});

test("every scene has spoken narration", () => {
  for (const s of SCENES) assert.ok(typeof s.say === "string" && s.say.length > 10, s.id);
});
test("the Marvel narration dedicates the zone to Amalia", () => {
  assert.match(SCENES.find(s => s.id === "marvel").say, /dedicated to Amalia/);
});
test("narration is in English (the captions stay Hebrew)", () => {
  for (const s of SCENES) assert.ok(!/[\u0590-\u05FF]/.test(s.say), s.id);
});

import { OUTRO } from "../scenes.mjs";
test("the outro closes with an English line and an end card for the site", () => {
  assert.equal(OUTRO.id, "outro");
  assert.ok(OUTRO.say.length > 10 && !/[֐-׿]/.test(OUTRO.say));
  assert.match(OUTRO.say, /Bingology/);
  assert.equal(OUTRO.card.title, "Bingology");
  assert.equal(OUTRO.card.url, "achiyafried.github.io/bingology");
  assert.ok(OUTRO.dwell >= 6, "holds long enough for the music's last hit");
  assert.equal(typeof OUTRO.run, "function");
});
