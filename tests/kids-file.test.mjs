import { test } from "node:test";
import assert from "node:assert/strict";
import { validateKids, kidsLive, kidsArt, overCap, AGES, AGE_CAP } from "../scripts/lib/kids.mjs";

test("validateKids accepts good rows", () => {
  assert.deepEqual(validateKids([{ tmdb: 1, age: "small" }, { tmdb: 2, age: "big", he: "שם" }]), []);
});

test("validateKids names each bad row", () => {
  const errs = validateKids([
    { tmdb: 1, age: "mid" }, { tmdb: 1, age: "mid" }, // duplicate
    { tmdb: "3", age: "mid" },                        // tmdb not a number
    { tmdb: 4, age: "teen" },                         // unknown age
    { tmdb: 5, age: "mid", he: 5 },                   // he not text
    { tmdb: 6, age: "mid", he: "  " },                // he empty
  ]);
  for (const [i, re] of [[1, /duplicate/], [2, /tmdb/], [3, /age/], [4, /he/], [5, /he/]])
    assert.ok(errs.some(e => e.startsWith(`row ${i}:`) && re.test(e)), `row ${i} ${re}: ${errs.join(" | ")}`);
  assert.equal(validateKids("x").length, 1);
});

test("AGES and caps", () => {
  assert.deepEqual(AGES, ["small", "mid", "big"]);
  assert.deepEqual(AGE_CAP, { small: 7, mid: 10, big: 13 });
});

const map = { netflix: ["Netflix"], disney: ["Disney Plus"] };
const bluey = {
  id: 82728, name: "Bluey", poster_path: "/b.jpg", first_air_date: "2018-10-01", number_of_seasons: 3,
  overview: "EN bluey", vote_average: 8.66, vote_count: 10,
  content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-Y" }] },
  "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Disney Plus" }] } } },
};

test("kidsLive maps a TMDB show", () => {
  const x = kidsLive(bluey, { name: "בלואי", overview: "תקציר" }, map);
  assert.deepEqual(x, {
    name: "Bluey", nameHe: "בלואי", poster: "https://image.tmdb.org/t/p/w342/b.jpg",
    overview: "תקציר", overviewEn: "EN bluey", year: 2018, seasons: 3, vote: 8.7, minAge: 0,
    providers: ["disney"], providersGuess: [],
  });
});

test("kidsLive: no Hebrew, no poster, no votes", () => {
  const x = kidsLive({ id: 1, name: "X", poster_path: null, vote_count: 0, vote_average: 0, overview: "" }, null, map);
  assert.equal(x.nameHe, null);
  assert.equal(x.poster, null);
  assert.equal(x.vote, null);
  assert.equal(x.overview, null);
  assert.equal(x.overviewEn, null);
  assert.equal(x.year, null);
  assert.deepEqual(x.providers, []);
});

test("overCap", () => {
  assert.equal(overCap({ age: "small", minAge: 7 }), false);
  assert.equal(overCap({ age: "small", minAge: 10 }), true);
  assert.equal(overCap({ age: "big", minAge: null }), false);
  assert.equal(overCap({ age: "big", minAge: 14 }), true);
});

import { readFileSync } from "node:fs";

test("the real kids.json is valid with at least 20 series per group", () => {
  const list = JSON.parse(readFileSync("kids.json", "utf8"));
  assert.deepEqual(validateKids(list), []);
  for (const age of AGES) assert.ok(list.filter(r => r.age === age).length >= 20, `${age}: ${list.filter(r => r.age === age).length}`);
});

test("site/kids-data.json has no series above its cap and at least 15 per group with a poster", () => {
  const { items } = JSON.parse(readFileSync("site/kids-data.json", "utf8"));
  assert.deepEqual(items.filter(overCap).map(x => x.tmdb), []);
  for (const age of AGES) assert.ok(items.filter(x => x.age === age && x.poster).length >= 15, age);
});

const UC = c => "UC" + c.repeat(22);

test("validateKids accepts art and yt", () => {
  assert.deepEqual(validateKids([{ tmdb: 1, age: "small", art: { img: "/a.jpg", x: .4, y: .5, r: .2 },
    yt: [{ channel: UC("a") }, { channel: UC("b"), match: "Bluey" }] }]), []);
});

test("validateKids rejects bad art", () => {
  for (const art of [{ x: 1.2 }, { r: 0 }, { img: "a.jpg" }, { img: "/a.gif" }, "x"]) {
    const errs = validateKids([{ tmdb: 1, age: "small", art }]);
    assert.ok(errs.some(e => e.startsWith("row 0:") && /art/.test(e)), JSON.stringify(art));
  }
});

test("validateKids rejects bad yt", () => {
  const bad = [[], [1, 2, 3, 4].map(n => ({ channel: UC(String(n)) })), [{ channel: UC("a") }, { channel: UC("a") }],
    [{ channel: "UCshort" }], [{ channel: UC("a"), match: "" }], { channel: UC("a") }];
  for (const yt of bad) {
    const errs = validateKids([{ tmdb: 1, age: "small", yt }]);
    assert.ok(errs.some(e => e.startsWith("row 0:") && /yt/.test(e)), JSON.stringify(yt));
  }
});

test("kidsArt prefers the hand-picked image", () => {
  const images = { backdrops: [{ file_path: "/n.jpg", iso_639_1: null }] };
  assert.ok(kidsArt(images, { img: "/h.jpg" }).backdrop.endsWith("/w780/h.jpg"));
});

test("kidsArt picks the first textless backdrop", () => {
  const images = { backdrops: [{ file_path: "/en.jpg", iso_639_1: "en" }, { file_path: "/n.jpg", iso_639_1: null }] };
  assert.equal(kidsArt(images).backdrop, "https://image.tmdb.org/t/p/w780/n.jpg");
});

test("kidsArt with only texted backdrops or no images", () => {
  assert.equal(kidsArt({ backdrops: [{ file_path: "/en.jpg", iso_639_1: "en" }] }).backdrop, null);
  assert.equal(kidsArt(undefined).backdrop, null);
});

test("kidsArt sticker defaults", () => {
  assert.deepEqual(kidsArt(undefined).sticker, { x: .5, y: .5, r: .3 });
  assert.deepEqual(kidsArt(undefined, { y: .4 }).sticker, { x: .5, y: .4, r: .3 });
});

test("validateKids: cutout must be true when present", () => {
  assert.deepEqual(validateKids([{ tmdb: 1, age: "small", cutout: true }]), []);
  for (const bad of [1, "yes", false, null]) {
    const e = validateKids([{ tmdb: 1, age: "small", cutout: bad }]);
    assert.equal(e.length, 1); assert.match(e[0], /^row 0: .*cutout/);
  }
});
