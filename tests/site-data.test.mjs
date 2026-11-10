import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromData } from "../site/lib/data.js";
import { loadSeen, saveSeen } from "../site/lib/seen.js";

const S = fromData(JSON.parse(readFileSync("tests/fixtures/data-small.json", "utf8")));
const memStorage = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test("fromData builds the legacy series shape", () => {
  const bb = S[0], sev = S[1], ted = S[2];
  assert.equal(bb.id, 0); assert.equal(bb.n, "Breaking Bad"); assert.equal(bb.s, 5); assert.equal(bb.m, 47);
  assert.equal(bb.h, 3); assert.deepEqual(bb.g, ["crime", "thriller", "drama"]); assert.equal(bb.nyt, 1);
  assert.equal(bb.l, "מורה לכימיה");
  assert.equal(sev.l, "תקציר עברי");
  assert.equal(sev.airing, true);
  assert.equal(ted.nyt, null); assert.equal(ted.praise, "מבקרים אוהבים"); assert.deepEqual(ted.awards, ["אמי"]);
  assert.equal(bb.praise, null); assert.deepEqual(bb.awards, []); assert.equal(bb.castLabel, null);
});

test("legacy v1 seen indices migrate and unknown ones are dropped", () => {
  const st = memStorage();
  st.setItem("tvpick:v1", JSON.stringify({ seen: [1, 99] }));
  assert.deepEqual([...loadSeen(st, S)], [1]);
});

test("v2 stores tmdb ids and wins over v1", () => {
  const st = memStorage();
  saveSeen(st, new Set([1]), S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen, [95396]);
  st.setItem("tvpick:v1", JSON.stringify({ seen: [0] }));
  assert.deepEqual([...loadSeen(st, S)], [1]);
});

test("blocked storage gives an empty set and saving does not throw", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(loadSeen(blocked, S).size, 0);
  assert.doesNotThrow(() => saveSeen(blocked, new Set([0]), S));
});

test("fromData passes the series status through", () => {
  assert.equal(S[0].status, "ended");
  assert.equal(S[1].status, "airing");
  assert.equal(fromData({ series: [{ name: "X", lists: [] }] })[0].status, null);
});

test("seen marks for series not in today's data are kept when saving", () => {
  const st = memStorage();
  st.setItem("tvpick:v2", JSON.stringify({ seen: [95396, 777777] })); // 777777 rotated out of the pool
  const seen = loadSeen(st, S);
  assert.deepEqual([...seen], [1]);
  seen.add(0);
  saveSeen(st, seen, S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen.sort((a, b) => a - b), [1396, 95396, 777777]);
  seen.delete(1);
  saveSeen(st, seen, S);
  assert.deepEqual(JSON.parse(st.m.get("tvpick:v2")).seen.sort((a, b) => a - b), [1396, 777777]);
});
