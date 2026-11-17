import { test } from "node:test";
import assert from "node:assert/strict";
import { visible, ordered, groups, nextUp, progress } from "../site/mcu/timeline.js";
import { loadSeen, saveSeen, loadPref, savePref } from "../site/mcu/seen.js";

const it = (id, story_i, date, era, phase, o = {}) => ({ id, story_i, date, era, phase, fetchedAt: "x", ...o });
const A = it("movie:1", 0, "2011-07-22", "שנות ה-40", 1);
const B = it("movie:2", 1, "2019-03-06", "שנות ה-90", 3);
const C = it("movie:3", 2, "2008-04-30", "2008–2012", 1);
const D = it("movie:4", 3, "2012-04-25", "2008–2012", 1);
const F = it("movie:5", 4, "2026-12-16", "2026 ואילך", 6);
const N = it("movie:6", 5, "2010-01-01", "2008–2012", 1, { fetchedAt: undefined });
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };

test("visible: no data → hidden; a future date → upcoming, by date", () => {
  const later = it("movie:7", 6, "2027-05-01", "x", 6);
  const { released, upcoming } = visible([later, A, F, N, B], "2026-11-17");
  assert.deepEqual(released.map(x => x.id), ["movie:1", "movie:2"]);
  assert.deepEqual(upcoming.map(x => x.id), ["movie:5", "movie:7"]);
});

test("ordered: story by story_i, release by date then story_i", () => {
  assert.deepEqual(ordered([C, B, A, D], "story").map(x => x.id), ["movie:1", "movie:2", "movie:3", "movie:4"]);
  assert.deepEqual(ordered([A, B, C, D], "release").map(x => x.id), ["movie:3", "movie:1", "movie:4", "movie:2"]);
});

test("groups: consecutive eras in story order, phases in release order", () => {
  assert.deepEqual(groups([A, B, C, D], "story").map(g => [g.title, g.items.length]), [["שנות ה-40", 1], ["שנות ה-90", 1], ["2008–2012", 2]]);
  assert.deepEqual(groups([A, B, C, D], "release").map(g => [g.title, g.items.length]), [["שלב 1", 3], ["שלב 3", 1]]);
});

test("nextUp: the first unseen in the chosen order; null when all are seen", () => {
  const all = [A, B, C, D];
  assert.equal(nextUp(all, new Set(["movie:1"]), "story").id, "movie:2");
  assert.equal(nextUp(all, new Set(["movie:3"]), "release").id, "movie:1");
  assert.equal(nextUp(all, new Set(all.map(x => x.id)), "story"), null);
});

test("progress counts only ids that are on the timeline", () => {
  assert.deepEqual(progress([A, B, C], new Set(["movie:1", "movie:99"])), { done: 1, total: 3 });
});

test("seen marks: saved and loaded; unknown ids are kept", () => {
  const s = mem();
  assert.equal(saveSeen(s, new Set(["movie:1", "movie:99"])), true);
  const { ids, ok } = loadSeen(s);
  assert.equal(ok, true);
  assert.deepEqual([...ids].sort(), ["movie:1", "movie:99"]);
});

test("seen marks without storage: empty, ok false, saving never throws", () => {
  const { ids, ok } = loadSeen(broken);
  assert.equal(ok, false); assert.equal(ids.size, 0);
  assert.equal(saveSeen(broken, new Set(["movie:1"])), false);
  assert.equal(loadSeen(null).ok, false);
  const junk = mem(); junk.setItem("bingology:mcu-seen", "{oops"); assert.equal(loadSeen(junk).ids.size, 0);
});

test("prefs: only allowed values, else the fallback", () => {
  const s = mem();
  assert.equal(loadPref(s, "bingology:mcu-theme", ["cosmic", "comic", "hud"], "cosmic"), "cosmic");
  savePref(s, "bingology:mcu-theme", "hud");
  assert.equal(loadPref(s, "bingology:mcu-theme", ["cosmic", "comic", "hud"], "cosmic"), "hud");
  s.setItem("bingology:mcu-theme", "evil");
  assert.equal(loadPref(s, "bingology:mcu-theme", ["cosmic", "comic", "hud"], "cosmic"), "cosmic");
  assert.equal(loadPref(broken, "k", ["a"], "a"), "a");
  assert.doesNotThrow(() => savePref(broken, "k", "a"));
});

test("groups in release order: one heading per phase even when release dates interleave phases", () => {
  const ff = it("movie:10", 10, "2025-07-23", "x", 6), eyes = it("tv:11:s1", 0, "2025-08-01", "x", 5), thb = it("movie:12", 9, "2025-04-30", "x", 5);
  const g = groups([ff, eyes, thb], "release");
  assert.deepEqual(g.map(x => x.title), ["שלב 5", "שלב 6"]);
  assert.deepEqual(g[0].items.map(x => x.id), ["movie:12", "tv:11:s1"], "by date inside the phase");
});
