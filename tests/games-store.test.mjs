import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadDay, saveDay, loadPractice, savePractice, markComplete, streak, dayProgress, prune, saveTotal, loadTotal,
} from "../site/lib/games/store.js";

function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const throwing = {
  getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); },
  removeItem() { throw new Error("blocked"); }, key() { throw new Error("blocked"); },
  get length() { throw new Error("blocked"); },
};

test("saveDay / loadDay round trip under bingology:games:<date>", () => {
  const s = mem();
  saveDay(s, "2026-11-13", { guess: { done: true, n: 3 } });
  assert.ok(s.m.has("bingology:games:2026-11-13"));
  assert.deepEqual(loadDay(s, "2026-11-13"), { guess: { done: true, n: 3 } });
  assert.deepEqual(loadDay(s, "2026-11-14"), {});
});

test("practice is one slot, replaced when the date differs", () => {
  const s = mem();
  savePractice(s, "2026-11-12", { odd: { done: false } });
  assert.deepEqual(loadPractice(s, "2026-11-12"), { odd: { done: false } });
  assert.deepEqual(loadPractice(s, "2026-11-11"), {});
  savePractice(s, "2026-11-11", { blur: { done: true } });
  assert.deepEqual(loadPractice(s, "2026-11-12"), {});
  assert.deepEqual(loadPractice(s, "2026-11-11"), { blur: { done: true } });
  assert.equal([...s.m.keys()].filter(k => k.includes("practice")).length, 1);
});

test("streak goes 1 then 2 on consecutive days; skipped day resets to 1", () => {
  const s = mem();
  assert.equal(markComplete(s, "2026-11-10"), 1);
  assert.equal(markComplete(s, "2026-11-11"), 2);
  assert.equal(markComplete(s, "2026-11-13"), 1);
  assert.deepEqual(JSON.parse(s.m.get("bingology:games:streak")), { last: "2026-11-13", n: 1 });
});

test("markComplete is idempotent per date", () => {
  const s = mem();
  markComplete(s, "2026-11-10");
  assert.equal(markComplete(s, "2026-11-11"), 2);
  assert.equal(markComplete(s, "2026-11-11"), 2);
});

test("streak() is 0 unless last is today or yesterday", () => {
  const s = mem();
  assert.equal(streak(s, "2026-11-13"), 0);
  markComplete(s, "2026-11-11");
  markComplete(s, "2026-11-12");
  assert.equal(streak(s, "2026-11-12"), 2);
  assert.equal(streak(s, "2026-11-13"), 2);
  assert.equal(streak(s, "2026-11-14"), 0);
});

test("practice never touches the streak", () => {
  const s = mem();
  markComplete(s, "2026-11-12");
  savePractice(s, "2026-11-12", { guess: { done: true } });
  assert.equal(streak(s, "2026-11-13"), 1);
  assert.deepEqual(JSON.parse(s.m.get("bingology:games:streak")), { last: "2026-11-12", n: 1 });
});

test("dayProgress counts states with done: true", () => {
  const s = mem();
  assert.equal(dayProgress(s, "2026-11-13"), 0);
  saveDay(s, "2026-11-13", { guess: { done: true }, odd: { done: false }, chain: { done: true }, blur: {} });
  assert.equal(dayProgress(s, "2026-11-13"), 2);
});

test("prune removes day keys older than 30 days only", () => {
  const s = mem({
    "bingology:games:2026-10-13": "{}", // exactly 30 days before: kept
    "bingology:games:2026-10-12": "{}", // 31 days: removed
    "bingology:games:2026-01-01": "{}",
    "bingology:games:2026-11-13": "{}",
    "bingology:games:streak": '{"last":"2026-01-01","n":3}',
    "bingology:games:practice": '{"date":"2026-01-01","states":{}}',
    "bingology:newsSeen": "x",
  });
  prune(s, "2026-11-12");
  assert.deepEqual([...s.m.keys()].sort(), [
    "bingology:games:2026-10-13", "bingology:games:2026-11-13",
    "bingology:games:practice", "bingology:games:streak", "bingology:newsSeen",
  ]);
  prune(s, "2026-11-12", 0);
  assert.ok(!s.m.has("bingology:games:2026-10-13"));
  assert.ok(s.m.has("bingology:games:2026-11-13"));
});

test("null, bad JSON and throwing storage never throw", () => {
  for (const s of [null, undefined, throwing]) {
    assert.deepEqual(loadDay(s, "2026-11-13"), {});
    saveDay(s, "2026-11-13", { a: 1 });
    assert.deepEqual(loadPractice(s, "2026-11-13"), {});
    savePractice(s, "2026-11-13", {});
    assert.equal(streak(s, "2026-11-13"), 0);
    assert.equal(dayProgress(s, "2026-11-13"), 0);
    prune(s, "2026-11-13");
  }
  assert.equal(markComplete(null, "2026-11-13"), 1);
  assert.equal(markComplete(throwing, "2026-11-13"), 1);
  const bad = mem({
    "bingology:games:2026-11-13": "{bad", "bingology:games:streak": "{bad", "bingology:games:practice": "{bad",
  });
  assert.deepEqual(loadDay(bad, "2026-11-13"), {});
  assert.deepEqual(loadPractice(bad, "2026-11-13"), {});
  assert.equal(streak(bad, "2026-11-13"), 0);
  assert.equal(dayProgress(bad, "2026-11-13"), 0);
  assert.equal(markComplete(bad, "2026-11-13"), 1);
});

test("valid JSON of the wrong shape is ignored", () => {
  const s = mem({ "bingology:games:2026-11-13": "[1,2]", "bingology:games:streak": '{"last":5,"n":"x"}' });
  assert.deepEqual(loadDay(s, "2026-11-13"), {});
  assert.equal(streak(s, "2026-11-13"), 0);
  assert.equal(markComplete(s, "2026-11-13"), 1);
});

test("total games of a day: one slot, null for another date or bad data", () => {
  const s = mem();
  assert.equal(loadTotal(s, "2026-11-13"), null);
  saveTotal(s, "2026-11-13", 4);
  assert.equal(loadTotal(s, "2026-11-13"), 4);
  assert.equal(loadTotal(s, "2026-11-14"), null);
  saveTotal(s, "2026-11-14", 5);
  assert.equal(loadTotal(s, "2026-11-13"), null);
  assert.equal(loadTotal(mem({ "bingology:games:total": "{oops" }), "2026-11-13"), null);
  assert.equal(loadTotal(mem({ "bingology:games:total": '{"date":"2026-11-13","n":"5"}' }), "2026-11-13"), null);
});
