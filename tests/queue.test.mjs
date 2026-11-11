import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueue, pending, flush } from "../site/lib/account/queue.js";

const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, o }; };

test("same tmdbId keeps only the later row", () => {
  const st = mem();
  enqueue(st, 1, { tmdb_id: 1, status: "want" });
  enqueue(st, 1, { tmdb_id: 1, status: "seen" });
  assert.deepEqual(pending(st), [{ tmdb_id: 1, status: "seen" }]);
});

test("rows replay in enqueue order", async () => {
  const st = mem();
  enqueue(st, 3, { tmdb_id: 3 }); enqueue(st, 1, { tmdb_id: 1 }); enqueue(st, 2, { tmdb_id: 2 });
  const seen = [];
  const r = await flush(st, async row => { seen.push(row.tmdb_id); });
  assert.deepEqual(seen, [3, 1, 2]);
  assert.deepEqual(r, { sent: 3, failed: 0, gaveUp: [] });
  assert.deepEqual(pending(st), []);
});

test("failing row stays, counts attempts, and is dropped after the 3rd failure", async () => {
  const st = mem();
  enqueue(st, 1, { tmdb_id: 1 }); enqueue(st, 2, { tmdb_id: 2 });
  const send = async row => { if (row.tmdb_id === 1) throw new Error("x"); };
  let r = await flush(st, send);
  assert.deepEqual(r, { sent: 1, failed: 1, gaveUp: [] });
  assert.deepEqual(pending(st), [{ tmdb_id: 1 }]);
  assert.equal(JSON.parse(st.o["bingology:queue"])[0].attempts, 1);
  await flush(st, send);
  assert.equal(JSON.parse(st.o["bingology:queue"])[0].attempts, 2);
  r = await flush(st, send);
  assert.deepEqual(r.gaveUp, [1]);
  assert.deepEqual(pending(st), []);
});

test("throwing storage is harmless", async () => {
  const bad = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  assert.deepEqual(pending(bad), []);
  assert.doesNotThrow(() => enqueue(bad, 1, { tmdb_id: 1 }));
  assert.deepEqual(await flush(bad, async () => {}), { sent: 0, failed: 0, gaveUp: [] });
});
