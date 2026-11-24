import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../scripts/fetch-kids.mjs";

process.env.TMDB_TOKEN = "t";
const NOW = "2026-11-19T03:00:00Z";
const map = { netflix: ["Netflix"], disney: ["Disney Plus"] };
const show = (id, rating = "TV-Y") => ({
  id, name: `Show ${id}`, poster_path: `/${id}.jpg`, first_air_date: "2020-01-01", number_of_seasons: 2,
  overview: "EN", vote_average: 7, vote_count: 5,
  content_ratings: { results: [{ iso_3166_1: "US", rating }] },
  "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Netflix" }] } } },
});

/** Fake TMDB: `fail` = ids answering 500; `rating` = per-id US rating. */
function fake({ fail = new Set(), rating = {} } = {}) {
  const calls = [];
  const f = async url => {
    const u = new URL(url); calls.push(u.pathname); f.urls.push(u);
    const m = /\/tv\/(\d+)$/.exec(u.pathname);
    if (!m) return new Response("{}", { status: 404 });
    const id = +m[1];
    if (fail.has(id)) return new Response("{}", { status: 500 });
    if (u.searchParams.get("language") === "he-IL") return new Response(JSON.stringify({ id, name: `סדרה ${id}`, overview: "תקציר" }));
    return new Response(JSON.stringify({ ...show(id, rating[id]), images: { backdrops: [{ file_path: "/b.jpg", iso_639_1: null }] } }));
  };
  f.calls = calls; f.urls = [];
  return f;
}

test("maps rows and lets the hand-written Hebrew name win", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "mid", he: "שם ידני" }, { tmdb: 2, age: "small" }], prev: null, fetchImpl: fake(), now: NOW, map });
  assert.equal(r.abort, false);
  assert.equal(r.data.updatedAt, NOW);
  const [a, b] = r.data.items;
  assert.equal(a.nameHe, "שם ידני");
  assert.equal(a.age, "mid");
  assert.equal(a.tmdb, 1);
  assert.equal(a.fetchedAt, NOW);
  assert.deepEqual(a.providers, ["netflix"]);
  assert.equal(b.nameHe, "סדרה 2");
});

test("a failed row keeps yesterday's details with today's age", async () => {
  const prev = { items: [{ tmdb: 2, age: "small", name: "Old", nameHe: "ישן", poster: null, minAge: 0, providers: [] }] };
  const r = await run({ rows: [{ tmdb: 1, age: "mid" }, { tmdb: 2, age: "mid" }], prev, fetchImpl: fake({ fail: new Set([2]) }), now: NOW, map });
  const old = r.data.items.find(x => x.tmdb === 2);
  assert.equal(old.name, "Old");
  assert.equal(old.age, "mid");
  assert.equal(r.failed, 1);
});

test("a new row that fails is left out", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "mid" }, { tmdb: 2, age: "mid" }, { tmdb: 3, age: "mid" }, { tmdb: 4, age: "mid" }, { tmdb: 5, age: "mid" }], prev: null, fetchImpl: fake({ fail: new Set([2]) }), now: NOW, map });
  assert.deepEqual(r.data.items.map(x => x.tmdb), [1, 3, 4, 5]);
  assert.equal(r.failed, 1);
  assert.equal(r.abort, false);
});

test("drops a series above its group's cap", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "small" }, { tmdb: 2, age: "big" }], prev: null, fetchImpl: fake({ rating: { 1: "TV-PG", 2: "TV-PG" } }), now: NOW, map });
  assert.deepEqual(r.data.items.map(x => x.tmdb), [2]);
  assert.ok(r.warnings.some(w => /^1: .*above the small cap/.test(w)), r.warnings.join(" | "));
});

test("more than 20% failures aborts", async () => {
  const rows = [1, 2, 3, 4, 5].map(tmdb => ({ tmdb, age: "mid" }));
  assert.equal((await run({ rows, prev: null, fetchImpl: fake({ fail: new Set([1, 2]) }), now: NOW, map })).abort, true);
  assert.equal((await run({ rows, prev: null, fetchImpl: fake({ fail: new Set([1]) }), now: NOW, map })).abort, false);
});

test("bad rows are skipped with a warning", async () => {
  const f = fake();
  const r = await run({ rows: [{ tmdb: "x", age: "mid" }, { tmdb: 7, age: "mid" }], prev: null, fetchImpl: f, now: NOW, map });
  assert.ok(r.warnings.some(w => w.startsWith("kids.json row 0")), r.warnings.join(" | "));
  assert.deepEqual(r.data.items.map(x => x.tmdb), [7]);
  assert.ok(f.calls.every(p => !p.includes("/x")));
});

test("a kids.json with no valid rows aborts instead of emptying the page", async () => {
  assert.equal((await run({ rows: [{ tmdb: "x", age: "mid" }], prev: null, fetchImpl: fake(), now: NOW, map })).abort, true);
  assert.equal((await run({ rows: { not: "an array" }, prev: null, fetchImpl: fake(), now: NOW, map })).abort, true);
});

const DAY = 864e5;
const ago = d => new Date(Date.parse(NOW) - d * DAY).toISOString();
const clip = { id: "aaaaaaaaaaa", title: "c", thumb: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg", sec: 100 };
const YT = [{ channel: "UC" + "a".repeat(22) }];
function spy(impl) { const f = async (...a) => { f.n++; return impl(...a); }; f.n = 0; return f; }
const one = { tmdb: 1, age: "small", yt: YT };
const prevWith = at => ({ items: [{ tmdb: 1, age: "small", name: "Old", nameHe: "ישן", minAge: 0, providers: [], clips: [{ ...clip, id: "bbbbbbbbbbb" }], clipsAt: at }] });

test("adds backdrop and sticker", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "small" }], prev: null, fetchImpl: fake(), now: NOW, map });
  const it = r.data.items[0];
  assert.ok(it.backdrop.endsWith("/w780/b.jpg"), it.backdrop);
  assert.deepEqual(it.sticker, { x: 0.5, y: 0.5, r: 0.3 });
  assert.equal("clips" in it, false);
  assert.equal("clipsAt" in it, false);
});

test("fetches clips when clipsAt is missing", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one], prev: null, fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(r.data.items[0].clips.length, 1);
  assert.equal(r.data.items[0].clipsAt, NOW);
  assert.equal(clipsImpl.n, 1);
});

test("keeps last week's clips when fresh", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one], prev: prevWith(ago(3)), fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(clipsImpl.n, 0);
  assert.equal(r.data.items[0].clips[0].id, "bbbbbbbbbbb");
  assert.equal(r.data.items[0].clipsAt, ago(3));
});

test("refreshes after 7 days", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one], prev: prevWith(ago(7)), fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(clipsImpl.n, 1);
  assert.equal(r.data.items[0].clips[0].id, "aaaaaaaaaaa");
});

test("no key keeps previous clips", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one], prev: prevWith(ago(30)), fetchImpl: fake(), now: NOW, map, youtubeKey: null, clipsImpl });
  assert.equal(clipsImpl.n, 0);
  assert.equal(r.data.items[0].clips[0].id, "bbbbbbbbbbb");
  assert.equal(r.data.items[0].clipsAt, ago(30));
});

test("YouTube failure keeps previous clips, warns, and is not a failure", async () => {
  const clipsImpl = spy(async () => { throw new Error("quota"); });
  const r = await run({ rows: [one], prev: prevWith(ago(30)), fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(r.data.items[0].clips[0].id, "bbbbbbbbbbb");
  assert.equal(r.data.items[0].clipsAt, ago(30));
  assert.ok(r.warnings.some(w => /^1: .*quota/.test(w)), r.warnings.join(" | "));
  assert.equal(r.failed, 0);
  assert.equal(r.abort, false);
});

test("warns about a series with no clips", async () => {
  const r = await run({ rows: [one], prev: null, fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl: async () => [] });
  assert.ok(r.warnings.some(w => /no clips/.test(w)), r.warnings.join(" | "));
  assert.deepEqual(r.data.items[0].clips, []);
});

test("a TMDB-failed series keeps its previous clips", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one, { tmdb: 2, age: "mid" }, { tmdb: 3, age: "mid" }, { tmdb: 4, age: "mid" }, { tmdb: 5, age: "mid" }, { tmdb: 6, age: "mid" }], prev: prevWith(ago(3)), fetchImpl: fake({ fail: new Set([1]) }), now: NOW, map, youtubeKey: "k", clipsImpl });
  const it = r.data.items.find(x => x.tmdb === 1);
  assert.equal(it.clips[0].id, "bbbbbbbbbbb");
  assert.equal(it.name, "Old");
});

test("a corrupt clipsAt counts as due", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one], prev: prevWith("garbage"), fetchImpl: fake(), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(clipsImpl.n, 1);
  assert.equal(r.data.items[0].clipsAt, NOW);
});

test("the en-US request asks for textless images", async () => {
  const f = fake();
  await run({ rows: [{ tmdb: 1, age: "small" }], prev: null, fetchImpl: f, now: NOW, map });
  const en = f.urls.find(u => u.searchParams.get("language") === "en-US");
  assert.ok(en.searchParams.get("append_to_response").split(",").includes("images"));
  assert.equal(en.searchParams.get("include_image_language"), "null");
});

test("no YouTube calls when the run aborts", async () => {
  const clipsImpl = spy(async () => [clip]);
  const r = await run({ rows: [one, { ...one, tmdb: 2 }], prev: null, fetchImpl: fake({ fail: new Set([one.tmdb, 2]) }), now: NOW, map, youtubeKey: "k", clipsImpl });
  assert.equal(r.abort, true);
  assert.equal(clipsImpl.n, 0);
});

test("copies cutout from kids.json, and drops it when the row loses it", async () => {
  const r = await run({ rows: [{ tmdb: 1, age: "small", cutout: true }, { tmdb: 2, age: "small" }], prev: null, fetchImpl: fake(), now: NOW, map });
  assert.equal(r.data.items.find(i => i.tmdb === 1).cutout, true);
  assert.equal("cutout" in r.data.items.find(i => i.tmdb === 2), false);
  const prev = { items: [{ tmdb: 3, age: "small", name: "S3", cutout: true }] };
  const r2 = await run({ rows: [{ tmdb: 3, age: "small" }], prev, fetchImpl: fake({ fail: new Set([3]) }), now: NOW, map });
  assert.equal("cutout" in r2.data.items[0], false);
});
