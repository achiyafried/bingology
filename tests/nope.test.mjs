import { test } from "node:test";
import assert from "node:assert/strict";
import { loadNope, saveNope, NOPE_KEY } from "../site/lib/nope.js";

const S = [{ tmdbId: 1396 }, { tmdbId: 1438 }];
const mem = (init = {}) => {
  const o = { ...init };
  return { o, getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = v; } };
};

test("NOPE_KEY", () => assert.equal(NOPE_KEY, "bingology:nope"));
test("empty storage gives empty set", () => assert.equal(loadNope(mem(), S).size, 0));
test("corrupt storage gives empty set", () => assert.equal(loadNope(mem({ [NOPE_KEY]: "{oops" }), S).size, 0));
test("throwing storage gives empty set", () => {
  assert.equal(loadNope({ getItem() { throw new Error("denied"); } }, S).size, 0);
});
test("round trip keeps indexes", () => {
  const st = mem();
  saveNope(st, new Set([1]), S);
  assert.deepEqual(JSON.parse(st.o[NOPE_KEY]), { nope: [1438] });
  assert.deepEqual([...loadNope(st, S)], [1]);
});
test("saveNope keeps ids not in S", () => {
  const st = mem({ [NOPE_KEY]: JSON.stringify({ nope: [999] }) });
  saveNope(st, new Set([0]), S);
  assert.deepEqual(JSON.parse(st.o[NOPE_KEY]).nope, [999, 1396]);
});
