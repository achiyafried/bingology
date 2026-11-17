import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickMarquee } from "../site/lib/marquee.js";

const P = n => `https://image.tmdb.org/t/p/w342/p${n}.jpg`;
const S = Array.from({ length: 100 }, (_, i) => ({ id: i, bs: 100 - i, poster: i % 10 === 9 ? null : P(i) }));
const seq = () => { let k = 0; return () => ((k++ * 0.37) % 1); };

test("pickMarquee: n distinct series with real posters, from the best-scored pool", () => {
  const ids = pickMarquee(S, 16, seq(), 40);
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, 16);
  for (const i of ids) { assert.ok(S[i].poster, `poster ${i}`); assert.ok(S[i].bs > 100 - 45, `top pool ${i}`); }
});

test("pickMarquee: a different draw gives a different selection; fewer series than n → all of them", () => {
  const a = pickMarquee(S, 16, seq(), 40), b = pickMarquee(S, 16, () => 0.99, 40);
  assert.notDeepEqual(a, b);
  assert.equal(pickMarquee(S.slice(0, 10), 16, seq()).length, 9, "one of the ten has no poster");
});

test("the home page shows the moving strip instead of the fan, and respects reduced motion", () => {
  const app = readFileSync("site/app.js", "utf8"), css = readFileSync("site/styles.css", "utf8");
  assert.doesNotMatch(app, /class="fan"/);
  assert.match(app, /class="marq"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^\n]*\.marq-track \{ animation: none; \}/);
  assert.match(css, /\.marq:hover \.marq-track[^{]*\{[^}]*animation-play-state: paused/);
});
