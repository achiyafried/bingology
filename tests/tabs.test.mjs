import { test } from "node:test";
import assert from "node:assert/strict";
import { TABS, tabsHTML } from "../site/lib/tabs.js";

test("eight tabs in order, the last two are links to their own pages", () => {
  assert.deepEqual(TABS.map(t => t.id), ["pick", "list", "actors", "search", "games", "mine", "mcu", "kids"]);
  assert.deepEqual(TABS.map(t => t.name), ["המלצה", "הרשימה", "קאסט", "חיפוש", "משחקים", "שלי", "מארוול", "ילדים"]);
});

test("every tab is an icon with its name as label and tooltip", () => {
  const h = tabsHTML("pick");
  assert.equal((h.match(/<svg /g) || []).length, 8);
  for (const t of TABS) assert.match(h, new RegExp(`aria-label="${t.name}" data-tip="${t.name}"`));
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(h), "no emoji");
});

test("only the current tab is selected and shows its name", () => {
  const h = tabsHTML("games");
  assert.match(h, /data-v="games" aria-selected="true"/);
  assert.equal((h.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((h.match(/class="tl"/g) || []).length, 1);
  assert.match(h, /<span class="tl">משחקים<\/span>/);
});

test("no tab is selected on the news page", () => {
  const h = tabsHTML(null);
  assert.ok(!h.includes('aria-selected="true"'));
  assert.ok(!h.includes('class="tl"'));
});

test("Marvel and kids are links with their own colors", () => {
  const h = tabsHTML("pick");
  assert.match(h, /<a class="tab mcu" href="mcu\.html"/);
  assert.match(h, /<a class="tab kids" href="kids\.html"/);
});
