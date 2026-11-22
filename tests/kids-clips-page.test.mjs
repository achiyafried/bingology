import test from "node:test";
import assert from "node:assert/strict";
import { ytState, withClips, nextIndex, onPlayerMessage, afterError, clipsPickerHTML, clipListHTML, playerBoxHTML, endedHTML } from "../site/kids/clips.js";

const B = "https://image.tmdb.org/t/p/w780/abc.jpg";
const clip = (id, o = {}) => ({ id, title: `T ${id}`, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, sec: 120, ...o });
const A = "aaaaaaaaaaa", Bb = "bbbbbbbbbbb", C = "ccccccccccc";
const it = (tmdb, o = {}) => ({ tmdb, name: `S${tmdb}`, age: "small", backdrop: B, clips: [clip(A), clip(Bb), clip(C)], ...o });

test("ytState reads onStateChange info, string or object", () => {
  assert.equal(ytState('{"event":"onStateChange","info":0}'), 0);
  assert.equal(ytState({ event: "onStateChange", info: 1 }), 1);
  assert.equal(ytState('{"event":"onError","info":150}'), null);
  assert.equal(ytState("junk"), null);
  assert.equal(ytState(null), null);
  assert.equal(ytState({ event: "onStateChange" }), null);
});

test("withClips keeps small items with a valid clip id", () => {
  const r = withClips([it(1), it(2, { clips: [] }), it(3, { clips: [clip("bad")] }), it(4, { age: "teen" }), it(5, { clips: undefined })]);
  assert.deepEqual(r.map(i => i.tmdb), [1]);
  assert.equal(withClips([it(6, { clips: [clip("bad"), clip(A)] })])[0].clips.length, 1);
});

test("nextIndex wraps", () => {
  assert.equal(nextIndex([1, 2, 3], 0), 1);
  assert.equal(nextIndex([1, 2, 3], 2), 0);
});

test("onPlayerMessage: ended / error, ignoring other sources and origins", () => {
  const w = {}, o = "https://www.youtube-nocookie.com";
  const end = '{"event":"onStateChange","info":0}';
  assert.equal(onPlayerMessage(end, o, w, w), "ended");
  assert.equal(onPlayerMessage('{"event":"onError","info":150}', o, w, w), "error");
  assert.equal(onPlayerMessage('{"event":"onStateChange","info":1}', o, w, w), "playing");
  assert.equal(onPlayerMessage('{"event":"onStateChange","info":3}', o, w, w), null);
  assert.equal(onPlayerMessage('{"event":"infoDelivery","info":{"playerState":0}}', o, w, w), "ended");
  assert.equal(onPlayerMessage(end, o, {}, w), null);
  assert.equal(onPlayerMessage(end, o, null, null), null);
  assert.equal(onPlayerMessage(end, o, undefined, undefined), null);
  assert.equal(onPlayerMessage(end, "https://evil.example", w, w), null);
});

test("picker: round sticker per series, aria-label is the name", () => {
  const h = clipsPickerHTML([it(1, { name: 'A"B' }), it(2, { clips: [] })]);
  assert.match(h, /data-a="go" data-v="clips\/1"/);
  assert.match(h, /aria-label="A&quot;B"/);
  assert.doesNotMatch(h, /clips\/2/);
});

test("clipListHTML: safeThumb, two columns data, escaped titles", () => {
  const item = it(1, { clips: [clip(A, { title: 'x"><b>' }), clip(Bb, { thumb: "https://evil.example/a.jpg" })] });
  const h = clipListHTML(item);
  assert.match(h, /data-a="clip" data-v="0"/);
  assert.match(h, /data-a="clip" data-v="1"/);
  assert.match(h, /aria-label="x&quot;&gt;&lt;b&gt;"/);
  assert.equal((h.match(/<img/g) || []).length, 1);
});

test("playerBoxHTML", () => {
  assert.equal(playerBoxHTML(it(1, { clips: [clip("bad")] }), 0, "https://x.test"), "");
  assert.equal(playerBoxHTML(it(1), 9, "https://x.test"), "");
  const h = playerBoxHTML(it(1), 0, "https://x.test");
  assert.match(h, /class="k-player"/);
  assert.match(h, /youtube-nocookie\.com\/embed\/aaaaaaaaaaa/);
  assert.match(h, /rel=0/);
});

test("endedHTML: thumb and two buttons, no iframe", () => {
  const h = endedHTML(it(1), 2);
  assert.match(h, /data-a="clip" data-v="2"[^>]*aria-label="שוב"|aria-label="שוב"[^>]*data-v="2"/);
  assert.match(h, /data-v="0"[^>]*aria-label="הקליפ הבא"|aria-label="הקליפ הבא"[^>]*data-v="0"/);
  assert.match(h, /🔁/); assert.match(h, /⏭/);
  assert.match(h, /<img/);
  assert.doesNotMatch(h, /iframe/);
});

test("ytState reads infoDelivery playerState", () => {
  assert.equal(ytState('{"event":"infoDelivery","info":{"playerState":0}}'), 0);
  assert.equal(ytState({ event: "infoDelivery", info: { playerState: 1 } }), 1);
  assert.equal(ytState({ event: "infoDelivery", info: { currentTime: 3 } }), null);
  assert.equal(ytState({ event: "infoDelivery" }), null);
});

test("afterError advances, then stops on the end screen once all clips failed", () => {
  let s = { tmdb: 1, i: 0, ended: false, errs: 0 };
  let r = afterError(s, 3); assert.equal(r.play, 1); assert.equal(r.state.errs, 1);
  r = afterError({ ...r.state, i: 1 }, 3); assert.equal(r.play, 2); assert.equal(r.state.errs, 2);
  r = afterError({ ...r.state, i: 2 }, 3); assert.equal(r.play, null);
  assert.equal(r.state.ended, true); assert.equal(r.state.errs, 0);
  assert.equal(afterError({ i: 0 }, 1).play, null);
});
