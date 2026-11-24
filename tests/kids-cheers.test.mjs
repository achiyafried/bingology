import test from "node:test";
import assert from "node:assert/strict";
import { CHEERS, pickCheer, cleanName, cheerHTML, makeSpeaker, MAX_PLAYERS, playersHTML, whoHTML } from "../site/kids/cheers.js";
import { loadPlayers, savePlayers, loadPlayer, savePlayer, loadNoName, saveNoName } from "../site/kids/store.js";

const seeded = () => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };

test("cheers: at least 15 per set; boy and girl sets name the child, the plain set doesn't", () => {
  for (const g of ["m", "f"]) {
    assert.ok(CHEERS[g].length >= 15);
    assert.ok(CHEERS[g].every(t => t.includes("{n}")));
  }
  assert.ok(CHEERS.none.length >= 8);
  assert.ok(CHEERS.none.every(t => !t.includes("{n}")));
  assert.ok(CHEERS.m.some(t => t.includes("תותח")) && CHEERS.f.some(t => t.includes("תותחית")));
});

test("pickCheer: the child's name in the right grammar, never the same twice in a row", () => {
  const rnd = seeded();
  let last = -1;
  for (let k = 0; k < 40; k++) {
    const c = pickCheer({ name: "דין", g: "m" }, rnd, last);
    assert.ok(c.text.includes("דין"));
    assert.ok(CHEERS.m.includes(c.template));
    assert.notEqual(c.idx, last);
    last = c.idx;
  }
  assert.ok(CHEERS.f.includes(pickCheer({ name: "נועה", g: "f" }, rnd).template));
  const plain = pickCheer(null, rnd);
  assert.ok(CHEERS.none.includes(plain.text));
});

test("cleanName: trimmed, at most 16 characters, no markup characters", () => {
  assert.equal(cleanName("  דין  "), "דין");
  assert.equal(cleanName("<b>דין</b>"), "bדין/b");
  assert.equal(cleanName("א".repeat(30)).length, 16);
  assert.equal(cleanName("   "), "");
  assert.equal(cleanName(null), "");
});

test("players storage: valid entries only, at most 4; current player index; skip flag", () => {
  const st = mem();
  assert.deepEqual(loadPlayers(st), []);
  savePlayers(st, [{ name: "דין", g: "m" }, { name: "נועה", g: "f" }]);
  assert.deepEqual(loadPlayers(st), [{ name: "דין", g: "m" }, { name: "נועה", g: "f" }]);
  st.setItem("bingology:kids-players", JSON.stringify([{ name: "x", g: "z" }, { name: "", g: "m" }, { name: "a", g: "f" }, 5]));
  assert.deepEqual(loadPlayers(st), [{ name: "a", g: "f" }]);
  st.setItem("bingology:kids-players", JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ name: `k${i}`, g: "m" }))));
  assert.equal(loadPlayers(st).length, MAX_PLAYERS);
  assert.equal(loadPlayer(st), 0);
  savePlayer(st, 1); assert.equal(loadPlayer(st), 1);
  assert.equal(loadNoName(st), false); saveNoName(st, true); assert.equal(loadNoName(st), true);
  assert.deepEqual(loadPlayers(broken), []); assert.equal(loadPlayer(broken), 0); assert.equal(loadNoName(broken), false);
});

test("cheerHTML: a live, escaped bubble", () => {
  const h = cheerHTML("<b>דין</b>! איזה תותח!!");
  assert.match(h, /^<div class="k-cheer" role="status" aria-live="polite">/);
  assert.doesNotMatch(h, /<b>/);
});

test("makeSpeaker: Hebrew voice speaks; muted or no Hebrew voice stays silent", () => {
  const spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = voices => ({ getVoices: () => voices, cancel() {}, speak(u) { spoken.push(u); } });
  const he = { lang: "he-IL", name: "Carmit" };
  let muted = false;
  const s = makeSpeaker(() => muted, synth([{ lang: "en-US" }, he]), U);
  assert.equal(s("דין! איזה תותח!!"), true);
  assert.equal(spoken[0].voice, he); assert.equal(spoken[0].lang, "he-IL");
  muted = true; assert.equal(s("x"), false);
  muted = false;
  assert.equal(makeSpeaker(() => false, synth([{ lang: "en-US" }]), U)("x"), false);
  assert.equal(makeSpeaker(() => false, undefined, undefined)("x"), false);
  assert.equal(spoken.length, 1);
});

test("playersHTML: a button per child (current pressed), add and remove", () => {
  const h = playersHTML([{ name: "דין", g: "m" }, { name: "<נועה>", g: "f" }], 1);
  assert.match(h, /data-a="player" data-v="0" aria-pressed="false"[^>]*>👦 דין</);
  assert.match(h, /data-a="player" data-v="1" aria-pressed="true"[^>]*>👧 &lt;נועה&gt;</);
  assert.match(h, /data-a="player-del" data-v="1"/);
  assert.match(h, /data-a="go" data-v="who"/);
  const full = playersHTML(Array.from({ length: 4 }, (_, i) => ({ name: `k${i}`, g: "m" })), 0);
  assert.doesNotMatch(full, /data-v="who"/);
});

test("whoHTML: name input, boy/girl, save and skip", () => {
  const h = whoHTML({ g: "f" });
  assert.match(h, /<input[^>]*id="k-who-name"[^>]*maxlength="16"/);
  assert.match(h, /data-a="who-g" data-v="m" aria-pressed="false"/);
  assert.match(h, /data-a="who-g" data-v="f" aria-pressed="true"/);
  assert.match(h, /data-a="who-save"/);
  assert.match(h, /data-a="who-skip"/);
});
