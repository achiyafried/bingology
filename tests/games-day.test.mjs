import { test } from "node:test";
import assert from "node:assert/strict";
import { israelToday, addDays, loadGamesDay } from "../site/lib/games/day.js";

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const day = (date, v = 1) => ({ date, v, used: { series: [], actors: [], pairs: [] }, games: {} });

test("israelToday across both DST switches", () => {
  // winter UTC+2, summer UTC+3
  assert.equal(israelToday(new Date("2026-01-15T21:59:00Z")), "2026-01-15");
  assert.equal(israelToday(new Date("2026-01-15T22:00:00Z")), "2026-01-16");
  assert.equal(israelToday(new Date("2026-07-15T20:59:00Z")), "2026-07-15");
  assert.equal(israelToday(new Date("2026-07-15T21:00:00Z")), "2026-07-16");
  // spring forward 2026-03-27 (Friday 02:00)
  assert.equal(israelToday(new Date("2026-03-26T21:59:00Z")), "2026-03-26");
  assert.equal(israelToday(new Date("2026-03-26T22:00:00Z")), "2026-03-27");
  assert.equal(israelToday(new Date("2026-03-27T20:59:00Z")), "2026-03-27");
  assert.equal(israelToday(new Date("2026-03-27T21:00:00Z")), "2026-03-28");
  // fall back 2026-10-25 (Sunday 02:00)
  assert.equal(israelToday(new Date("2026-10-24T20:59:00Z")), "2026-10-24");
  assert.equal(israelToday(new Date("2026-10-24T21:00:00Z")), "2026-10-25");
  assert.equal(israelToday(new Date("2026-10-25T21:59:00Z")), "2026-10-25");
  assert.equal(israelToday(new Date("2026-10-25T22:00:00Z")), "2026-10-26");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("loadGamesDay ok, with no-cache fetch of games/<date>.json", async () => {
  const calls = [];
  const f = async (url, opts) => { calls.push([url, opts]); return res(200, day("2026-11-13")); };
  const r = await loadGamesDay(f, "2026-11-13");
  assert.equal(r.status, "ok");
  assert.equal(r.day.date, "2026-11-13");
  assert.deepEqual(calls, [["games/2026-11-13.json", { cache: "no-cache" }]]);
});

test("loadGamesDay 404 with yesterday present gives practice", async () => {
  const f = async url => url.includes("2026-11-13") ? res(404) : res(200, day("2026-11-12"));
  const r = await loadGamesDay(f, "2026-11-13");
  assert.equal(r.status, "missing");
  assert.equal(r.practice.date, "2026-11-12");
});

test("loadGamesDay 404 both gives null practice", async () => {
  const r = await loadGamesDay(async () => res(404), "2026-11-13");
  assert.deepEqual(r, { status: "missing", practice: null });
});

test("loadGamesDay 404 then yesterday failing or wrong version gives null practice", async () => {
  const a = await loadGamesDay(async u => { if (u.includes("11-13")) return res(404); throw new Error("x"); }, "2026-11-13");
  assert.deepEqual(a, { status: "missing", practice: null });
  const b = await loadGamesDay(async u => u.includes("11-13") ? res(404) : res(200, day("2026-11-12", 2)), "2026-11-13");
  assert.deepEqual(b, { status: "missing", practice: null });
});

test("loadGamesDay v2 gives version", async () => {
  const r = await loadGamesDay(async () => res(200, day("2026-11-13", 2)), "2026-11-13");
  assert.deepEqual(r, { status: "version" });
});

test("loadGamesDay errors: throw, 500, bad json", async () => {
  assert.deepEqual(await loadGamesDay(async () => { throw new Error("net"); }, "2026-11-13"), { status: "error" });
  assert.deepEqual(await loadGamesDay(async () => res(500), "2026-11-13"), { status: "error" });
  const bad = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } });
  assert.deepEqual(await loadGamesDay(bad, "2026-11-13"), { status: "error" });
});
