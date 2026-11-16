import { test } from "node:test";
import assert from "node:assert/strict";
import { loadNope, saveNope, NOPE_KEY, staleNope, nopeCleared } from "../site/lib/nope.js";

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

test("staleNope: marks whose account row moved off nope (account wins); no row or a nope row keeps the mark", () => {
  const S4 = [{ tmdbId: 1 }, { tmdbId: 2 }, { tmdbId: 3 }, { tmdbId: 4 }];
  const entries = new Map([[1, { status: "want" }], [2, { status: "nope" }], [4, { status: "seen", rating: 9 }]]);
  assert.deepEqual(staleNope(S4, new Set([0, 1, 2, 3]), entries), [0, 3]);
  assert.deepEqual(staleNope(S4, new Set([1, 2]), entries), []);
  assert.deepEqual(staleNope(S4, new Set([0]), null), [], "no entries map (signed out)");
});

test("nopeCleared: true only when a nope row became something else (or went away)", () => {
  assert.equal(nopeCleared({ status: "nope" }, { status: "want" }), true);
  assert.equal(nopeCleared({ status: "nope" }, { status: "seen" }), true);
  assert.equal(nopeCleared({ status: "nope" }, null), true);
  assert.equal(nopeCleared({ status: "nope" }, { status: "nope" }), false);
  assert.equal(nopeCleared({ status: "want" }, { status: "seen" }), false);
  assert.equal(nopeCleared(undefined, { status: "seen" }), false);
});
