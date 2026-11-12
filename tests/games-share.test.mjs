import { test } from "node:test";
import assert from "node:assert/strict";
import { shareText } from "../site/lib/games/share.js";

const URL = "https://achiyafried.github.io/bingology/#games";

test("full line equals the spec example", () => {
  const out = shareText({
    date: "2026-11-13", streak: 4,
    results: [
      { id: "guess", label: "3/6" }, { id: "odd", label: "2/3" }, { id: "chain", label: "מושלם" },
      { id: "groups", label: "1 טעות" }, { id: "blur", label: "2/5" },
    ],
  });
  assert.equal(out, `Bingology · 13.11 · רצף 4 🔥\n🎬 3/6  🕵️ 2/3  🔗 מושלם  🧩 1 טעות  👤 2/5\n${URL}`);
});

test("streak 0 omits the streak part; day and month are not padded", () => {
  const out = shareText({ date: "2026-03-05", streak: 0, results: [{ id: "odd", label: "X" }] });
  assert.equal(out, `Bingology · 5.3\n🕵️ X\n${URL}`);
});

test("missing games are omitted, and no results leaves no empty line", () => {
  const out = shareText({ date: "2026-11-13", streak: 2, results: [{ id: "blur", label: "X/5" }, { id: "guess", label: "X/6" }] });
  assert.equal(out.split("\n")[1], "🎬 X/6  👤 X/5");
  assert.equal(shareText({ date: "2026-11-13", streak: 1, results: [] }), `Bingology · 13.11 · רצף 1 🔥\n${URL}`);
});

test("the riddle prints last, with its brain icon", () => {
  const out = shareText({ date: "2026-11-13", streak: 0, results: [{ id: "riddle", label: "✓" }, { id: "guess", label: "2/6" }] });
  assert.equal(out.split("\n")[1], "🎬 2/6  🧠 ✓");
});
