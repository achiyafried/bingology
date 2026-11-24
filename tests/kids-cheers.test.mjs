import test from "node:test";
import assert from "node:assert/strict";
import { CHEERS, pickCheer, cleanName, cleanEn, cheerHTML, makeSpeaker, MAX_PLAYERS, playersHTML, whoHTML, missingEn } from "../site/kids/cheers.js";
import { loadPlayers, savePlayers, loadPlayer, savePlayer, loadNoName, saveNoName } from "../site/kids/store.js";

const seeded = () => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };

test("cheers: English; at least 15 that name the child, at least 8 without a name", () => {
  assert.ok(CHEERS.en.length >= 15);
  assert.ok(CHEERS.en.every(t => t.includes("{n}") && !/[֐-׿]/.test(t)));
  assert.ok(CHEERS.none.length >= 8);
  assert.ok(CHEERS.none.every(t => !t.includes("{n}") && !/[֐-׿]/.test(t)));
});

test("pickCheer: the English spelling of the name, never the same twice in a row", () => {
  const rnd = seeded();
  let last = -1;
  for (let k = 0; k < 40; k++) {
    const c = pickCheer({ name: "דין", en: "Dean" }, rnd, last);
    assert.ok(c.text.includes("Dean")); assert.ok(!c.text.includes("דין"));
    assert.notEqual(c.idx, last); last = c.idx;
  }
  assert.ok(pickCheer({ name: "x", en: "$&$`" }, rnd).text.includes("$&$`"));
  assert.ok(CHEERS.none.includes(pickCheer({ name: "דין" }, rnd).text)); // no English spelling yet: no name
  assert.ok(CHEERS.none.includes(pickCheer(null, rnd).text));
});

test("cleanName (Hebrew, shown) and cleanEn (spoken)", () => {
  assert.equal(cleanName("  ג'וני  "), "ג'וני");
  assert.equal(cleanName("<b>דין</b>"), "bדין/b");
  assert.equal(cleanName("א".repeat(30)).length, 24);
  assert.equal(cleanEn("  Dean "), "Dean");
  assert.equal(cleanEn("Mary-Jane O'Neil"), "Mary-Jane O'Neil");
  assert.equal(cleanEn("דין<b>1"), "b");
  assert.equal(cleanEn("a".repeat(30)).length, 24);
  assert.equal(cleanEn(null), "");
});

test("players storage: Hebrew name with an optional English spelling, at most 4; old entries still load", () => {
  const st = mem();
  assert.deepEqual(loadPlayers(st), []);
  savePlayers(st, [{ name: "דין", en: "Dean" }, { name: "נועה", g: "f" }]);
  assert.deepEqual(loadPlayers(st), [{ name: "דין", en: "Dean" }, { name: "נועה", en: "" }]);
  st.setItem("bingology:kids-players", JSON.stringify([{ name: "", en: "x" }, 5, { name: "a", en: 7 }]));
  assert.deepEqual(loadPlayers(st), [{ name: "a", en: "" }]);
  st.setItem("bingology:kids-players", JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ name: `k${i}`, en: `K${i}` }))));
  assert.equal(loadPlayers(st).length, MAX_PLAYERS);
  assert.equal(loadPlayer(st), 0); savePlayer(st, 1); assert.equal(loadPlayer(st), 1);
  assert.equal(loadNoName(st), false); saveNoName(st, true); assert.equal(loadNoName(st), true);
  assert.deepEqual(loadPlayers(broken), []); assert.equal(loadPlayer(broken), 0);
});

test("missingEn: the first child without an English spelling", () => {
  assert.equal(missingEn([{ name: "דין", en: "Dean" }, { name: "נועה", en: "" }]), 1);
  assert.equal(missingEn([{ name: "דין", en: "Dean" }]), -1);
});

test("cheerHTML: a live, escaped, left-to-right bubble", () => {
  const h = cheerHTML("<b>Dean</b>! Superstar!");
  assert.match(h, /^<div class="k-cheer" role="status" aria-live="polite"><span dir="ltr">/);
  assert.doesNotMatch(h, /<b>/);
});

test("makeSpeaker: an English voice (on-device first); muted or no English voice stays silent", () => {
  const spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = voices => ({ getVoices: () => voices, cancel() {}, speak(u) { spoken.push(u); } });
  const net = { lang: "en-US", name: "net", localService: false }, local = { lang: "en_GB", name: "local", localService: true };
  let muted = false;
  const s = makeSpeaker(() => muted, synth([{ lang: "he-IL" }, net, local]), U);
  assert.equal(s("Dean! Superstar!"), true);
  assert.equal(spoken[0].voice, local); assert.match(spoken[0].lang, /^en/);
  muted = true; assert.equal(s("x"), false); muted = false;
  assert.equal(makeSpeaker(() => false, synth([{ lang: "he-IL" }]), U)("x"), false);
  assert.equal(makeSpeaker(() => false, undefined, undefined)("x"), false);
  assert.equal(spoken.length, 1);
});

test("playersHTML: the Hebrew name on each button (current pressed), add and remove", () => {
  const h = playersHTML([{ name: "דין", en: "Dean" }, { name: "<נועה>", en: "" }], 1);
  assert.match(h, /data-a="player" data-v="0" aria-pressed="false"[^>]*>⭐ דין</);
  assert.match(h, /data-a="player" data-v="1" aria-pressed="true"[^>]*>⭐ &lt;נועה&gt;</);
  assert.match(h, /data-a="player-del" data-v="1"/);
  assert.match(h, /data-a="go" data-v="who"/);
  assert.doesNotMatch(playersHTML(Array.from({ length: 4 }, (_, i) => ({ name: `k${i}`, en: "" })), 0), /data-v="who"/);
});

test("whoHTML: Hebrew name + English spelling; edit mode fills the name and asks only what's missing", () => {
  const h = whoHTML();
  assert.match(h, /<input[^>]*id="k-who-name"[^>]*maxlength="24"/);
  assert.match(h, /<input[^>]*id="k-who-en"[^>]*dir="ltr"[^>]*maxlength="24"/);
  assert.match(h, /data-a="who-save"/); assert.match(h, /data-a="who-skip"/);
  assert.doesNotMatch(h, /who-g/);
  const e = whoHTML({ edit: 1, name: "נועה" });
  assert.match(e, /data-a="who-save" data-edit="1"/);
  assert.match(e, /value="נועה"/);
  assert.doesNotMatch(e, /who-skip/);
});
