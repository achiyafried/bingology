import { test } from "node:test";
import assert from "node:assert/strict";
import { bingePlan } from "../site/lib/plan.js";

const bb = { e: 62, m: 47, s: 5 };
const start = new Date(2026, 10, 10); // 10 Nov 2026, local time

test("total watch time is episodes × episode length", () => {
  const p = bingePlan(bb, 2, start);
  assert.equal(p.totalMin, 2914);
  assert.equal(p.hours, 49);
});

test("evenings and finish date follow the pace (today counts as the first evening)", () => {
  const p = bingePlan(bb, 2, start);
  assert.equal(p.evenings, 31);
  assert.equal(p.finish.getFullYear(), 2026);
  assert.equal(p.finish.getMonth(), 11);
  assert.equal(p.finish.getDate(), 10);
  assert.equal(bingePlan(bb, 5, start).evenings, 13);
  assert.equal(bingePlan(bb, 1, start).evenings, 62);
});

test("marathon weekends assume 12 hours per weekend", () => {
  assert.equal(bingePlan(bb, 2, start).weekends, 5);
  assert.equal(bingePlan({ e: 6, m: 60, s: 1 }, 2, start).weekends, 1);
});

test("missing numbers give null instead of nonsense", () => {
  const p = bingePlan({ e: null, m: 45, s: 1 }, 2, start);
  assert.equal(p.hours, null);
  assert.equal(p.evenings, null);
  assert.equal(p.finish, null);
});
