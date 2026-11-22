import { test } from "node:test";
import assert from "node:assert/strict";
import { safeThumb } from "../site/lib/esc.js";
import { stickerStyle, withArt } from "../site/kids/art.js";
import { makeSound } from "../site/kids/sound.js";

test("safeThumb accepts only https ytimg thumbnails with an 11-char id", () => {
  const ok = "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg";
  assert.equal(safeThumb(ok), ok);
  assert.equal(safeThumb("http://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg"), null);
  assert.equal(safeThumb("https://evil.com/vi/aaaaaaaaaaa/mqdefault.jpg"), null);
  assert.equal(safeThumb("javascript:alert(1)"), null);
  assert.equal(safeThumb("https://i.ytimg.com/vi/aaaaaaaaaa/mqdefault.jpg"), null);
  assert.equal(safeThumb(null), null);
});

test("stickerStyle sizes and centres the circle (no image URL in the output)", () => {
  const css = stickerStyle({ x: 0.5, y: 0.5, r: 0.25 }, 72);
  assert.equal(css, "background-size:256px 144px;background-position:-92px -36px");
});

test("stickerStyle honours aspect and an off-centre point", () => {
  const css = stickerStyle({ x: 0.25, y: 0.75, r: 0.5 }, 100, 2);
  // H=100, W=200; pos = (50-50, 50-75)
  assert.equal(css, "background-size:200px 100px;background-position:0px -25px");
});

test("withArt keeps small items with a TMDB backdrop only", () => {
  const b = "https://image.tmdb.org/t/p/w780/abc.jpg";
  const list = [
    { tmdb: 1, age: "small", backdrop: b },
    { tmdb: 2, age: "mid", backdrop: b },
    { tmdb: 3, age: "small", backdrop: null },
    { tmdb: 4, age: "small", backdrop: "https://evil.com/x.jpg" },
  ];
  assert.deepEqual(withArt(list).map(i => i.tmdb), [1]);
});

test("makeSound never creates an AudioContext when muted", () => {
  let n = 0;
  globalThis.AudioContext = class { constructor() { n++; } };
  try {
    const s = makeSound(() => true);
    s.snap(); s.pair(); s.win();
    assert.equal(n, 0);
  } finally { delete globalThis.AudioContext; }
});

test("makeSound is silent without AudioContext, and creates it lazily once", () => {
  const s = makeSound(() => false);
  s.snap();
  let n = 0;
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  globalThis.AudioContext = class {
    constructor() { n++; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return node(); }
    createGain() { return node(); }
  };
  try {
    const t = makeSound(() => false);
    assert.equal(n, 0);
    t.snap(); t.pair(); t.win();
    assert.equal(n, 1);
  } finally { delete globalThis.AudioContext; }
});

test("makeSound resumes a suspended AudioContext", () => {
  let resumed = 0;
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  globalThis.AudioContext = class {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; }
    resume() { resumed++; return Promise.resolve(); }
    createOscillator() { return node(); }
    createGain() { return node(); }
  };
  try { makeSound(() => false).snap(); assert.equal(resumed, 1); } finally { delete globalThis.AudioContext; }
});

test("makeSound swallows a rejected resume()", () => {
  let caught = 0;
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  globalThis.AudioContext = class {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; }
    resume() { return { catch(fn) { caught++; fn(); return this; } }; }
    createOscillator() { return node(); }
    createGain() { return node(); }
  };
  try { makeSound(() => false).snap(); assert.equal(caught, 1); } finally { delete globalThis.AudioContext; }
});
