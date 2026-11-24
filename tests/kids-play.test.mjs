import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, gameRouteFor, backHash, shellHTML, homeHTML } from "../site/kids/play.js";
import { headerHTML } from "../site/kids/view.js";

const B = "https://image.tmdb.org/t/p/w780/b.jpg";
const s = (tmdb, o = {}) => ({ tmdb, age: "small", name: `S${tmdb}`, backdrop: B, ...o });

test("parseRoute", () => {
  assert.deepEqual(parseRoute(""), { game: null, arg: null });
  assert.deepEqual(parseRoute("#game"), { game: null, arg: null });
  assert.deepEqual(parseRoute("#play"), { game: "home", arg: null });
  assert.deepEqual(parseRoute("#play/puzzle/82728"), { game: "puzzle", arg: "82728" });
  assert.deepEqual(parseRoute("#play/memory"), { game: "memory", arg: null });
  assert.deepEqual(parseRoute("#play/nope"), { game: "home", arg: null });
});

test("backHash", () => {
  assert.equal(backHash({ game: "puzzle", arg: "1" }), "#play/puzzle");
  assert.equal(backHash({ game: "puzzle", arg: null }), "#play");
  assert.equal(backHash({ game: "memory", arg: null }), "#play");
  assert.equal(backHash({ game: "scene", arg: "park" }), "#play/scene");
  assert.equal(backHash({ game: "scene", arg: null }), "#play");
  assert.equal(backHash({ game: "clips", arg: "5" }), "#play/clips");
  assert.equal(backHash({ game: "clips", arg: null }), "");
  assert.equal(backHash({ game: "home", arg: null }), "");
});

test("headerHTML shows the games button only for small", () => {
  assert.match(headerHTML("small"), /data-a="play"/);
  assert.match(headerHTML("small"), /משחקים/);
  assert.doesNotMatch(headerHTML("mid"), /data-a="play"/);
  assert.doesNotMatch(headerHTML("big"), /data-a="play"/);
});

test("shellHTML", () => {
  const h = shellHTML("<p id=x>in</p>", { muted: false });
  assert.match(h, /data-a="home"[^>]*aria-label="חזרה"|aria-label="חזרה"[^>]*data-a="home"/);
  assert.match(h, /data-a="mute"/);
  assert.match(h, /aria-label="השתקה"/);
  assert.match(shellHTML("", { muted: true }), /aria-label="הפעלת צליל"/);
  assert.match(h, /<p id=x>in<\/p>/);
  assert.match(h, /TMDB/);
  assert.doesNotMatch(h, /k-back|k-ages/);
});

test("homeHTML tiles", () => {
  const two = [s(1), s(2), s(3, { backdrop: null })];
  const h2 = homeHTML(two);
  assert.match(h2, /data-v="puzzle"/);
  assert.match(h2, /data-v="scene"/);
  assert.doesNotMatch(h2, /data-v="memory"/);
  const h3 = homeHTML([s(1), s(2), s(3, { clips: [{ id: "aaaaaaaaaaa" }] })]);
  assert.match(h3, /data-v="memory"/);
  assert.doesNotMatch(h3, /clips/);
  for (const l of ["פאזל", "זיכרון", "איפה?"]) assert.match(h3, new RegExp(`aria-label="${l.replace("?", "\\?")}"`));
});

test("headerHTML: clips button only for small with clips", () => {
  assert.match(headerHTML("small", { hasClips: true }), /<button class="k-gamebtn k-clipbtn" data-a="clips">.*קליפים<\/button>/);
  assert.doesNotMatch(headerHTML("small", { hasClips: false }), /data-a="clips"/);
  assert.doesNotMatch(headerHTML("small"), /data-a="clips"/);
  assert.doesNotMatch(headerHTML("mid", { hasClips: true }), /data-a="clips"/);
});

test("every button has an aria-label", () => {
  const all = homeHTML([s(1), s(2), s(3, { clips: [{ id: "aaaaaaaaaaa" }] })]) + shellHTML("", { muted: false });
  for (const b of all.match(/<button[^>]*>/g)) assert.match(b, /aria-label="/);
});

test("gameRouteFor: games only for small", () => {
  assert.equal(gameRouteFor("#play/puzzle", "mid"), null);
  assert.equal(gameRouteFor("#play", "big"), null);
  assert.deepEqual(gameRouteFor("#play/puzzle", "small"), { game: "puzzle", arg: null });
  assert.equal(gameRouteFor("#game", "mid").game, null);
});
