import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUPS, LABEL, inGroup, servicesIn, pickServices, byServices } from "../site/kids/catalog.js";

const s = (tmdb, age, vote, providers = [], nameHe = null) => ({ tmdb, age, vote, providers, name: `S${tmdb}`, nameHe });

test("GROUPS in order with labels", () => {
  assert.deepEqual(GROUPS.map(g => g.id), ["small", "mid", "big"]);
  assert.equal(GROUPS[0].label, "קטנטנים 2–5");
  assert.equal(GROUPS[2].icon, "⚡");
  assert.equal(LABEL.disney, "Disney+");
});

test("inGroup keeps the group, best vote first, null votes last, then by name", () => {
  const items = [s(1, "mid", null), s(2, "mid", 7), s(3, "big", 9), s(4, "mid", 8), s(5, "mid", 7, [], "א")];
  assert.deepEqual(inGroup(items, "mid").map(x => x.tmdb), [4, 5, 2, 1]);
});

test("servicesIn lists the group's services in a fixed order, without other", () => {
  assert.deepEqual(servicesIn([s(1, "mid", 1, ["hbo", "netflix"]), s(2, "mid", 1, ["disney", "other"]), s(3, "mid", 1)]), ["netflix", "disney", "hbo"]);
  assert.deepEqual(servicesIn([]), []);
});

test("pickServices drops services the group does not have", () => {
  assert.deepEqual(pickServices(["hot", "netflix"], ["netflix"]), ["netflix"]);
  assert.deepEqual(pickServices([], ["netflix"]), []);
});

test("byServices: none selected keeps everything, else any match", () => {
  const items = [s(1, "mid", 1, ["netflix"]), s(2, "mid", 1, []), s(3, "mid", 1, ["disney", "hbo"])];
  assert.deepEqual(byServices(items, []).map(x => x.tmdb), [1, 2, 3]);
  assert.deepEqual(byServices(items, ["netflix"]).map(x => x.tmdb), [1]);
  assert.deepEqual(byServices(items, ["netflix", "hbo"]).map(x => x.tmdb), [1, 3]);
});
