import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../scripts/fetch-mcu.mjs";

process.env.TMDB_TOKEN = "t";
const NOW = "2026-11-17T03:00:00Z";
const map = { netflix: ["Netflix"], disney: ["Disney Plus"] };
const vid = (key, type = "Trailer") => ({ key, site: "YouTube", type, official: true, published_at: "2020" });
const movie = { id: 1771, title: "Captain America: The First Avenger", release_date: "2011-07-22", runtime: 124, poster_path: "/cap.jpg", overview: "EN cap", vote_average: 7.0, vote_count: 100,
  "watch/providers": { results: { IL: { flatrate: [{ provider_name: "Disney Plus" }] } } }, videos: { results: [vid("capTrailer1")] } };
const movieHe = { id: 1771, title: "קפטן אמריקה: הנוקם הראשון", overview: "תקציר" };
const show = { id: 84958, name: "Loki", poster_path: "/loki.jpg", overview: "EN loki", vote_average: 8.2, vote_count: 50,
  "watch/providers": { results: { US: { flatrate: [{ provider_name: "Disney Plus" }] } } }, videos: { results: [vid("lokiShow001")] } };
const showHe = { id: 84958, name: "לוקי", overview: "תקציר לוקי" };
const season = n => ({ season_number: n, air_date: n === 1 ? "2021-06-09" : "2023-10-05", poster_path: `/loki-s${n}.jpg`, overview: `EN s${n}`,
  episodes: [{ runtime: 50 }, { runtime: 45 }, { runtime: null }], videos: { results: n === 1 ? [vid("lokiS1Trlr1")] : [] } });

/** Fake TMDB (+ YouTube): `fail` = set of tmdb ids that answer 500; `blocked` = YouTube keys that don't play. */
function fake({ fail = new Set(), blocked = [] } = {}) {
  const calls = [];
  const f = async url => {
    const u = new URL(url); calls.push(u.pathname + u.search);
    if (u.hostname === "www.googleapis.com") {
      const ids = u.searchParams.get("id").split(",");
      return new Response(JSON.stringify({ items: ids.filter(i => !blocked.includes(i)).map(id => ({ id, status: { embeddable: true, privacyStatus: "public" }, contentDetails: {} })) }));
    }
    const he = u.searchParams.get("language") === "he-IL";
    let m;
    if ((m = /\/movie\/(\d+)$/.exec(u.pathname))) { if (fail.has(+m[1])) return new Response("{}", { status: 500 }); return new Response(JSON.stringify(he ? movieHe : movie)); }
    if ((m = /\/tv\/(\d+)\/season\/(\d+)$/.exec(u.pathname))) return new Response(JSON.stringify(season(+m[2])));
    if ((m = /\/tv\/(\d+)$/.exec(u.pathname))) { if (fail.has(+m[1])) return new Response("{}", { status: 500 }); return new Response(JSON.stringify(he ? showHe : show)); }
    return new Response("{}", { status: 404 });
  };
  f.calls = calls;
  return f;
}
const M = { id: "movie:1771", tmdb: 1771, kind: "movie", era: "שנות ה-40", story: "1943", phase: 1 };
const S = n => ({ id: `tv:84958:s${n}`, tmdb: 84958, kind: "season", season: n, era: "אחרי הבליפ", story: "מחוץ לזמן", phase: n === 1 ? 4 : 5 });

test("maps a movie", async () => {
  const { data, abort } = await run({ items: [M], prev: null, fetchImpl: fake(), now: NOW, map });
  assert.equal(abort, false);
  const x = data.items[0];
  assert.equal(x.id, "movie:1771"); assert.equal(x.story_i, 0); assert.equal(x.era, "שנות ה-40");
  assert.equal(x.name, "Captain America: The First Avenger"); assert.equal(x.nameHe, "קפטן אמריקה: הנוקם הראשון");
  assert.equal(x.date, "2011-07-22"); assert.equal(x.runtime, 124); assert.equal(x.episodes, null);
  assert.equal(x.poster, "https://image.tmdb.org/t/p/w342/cap.jpg");
  assert.equal(x.overview, "תקציר"); assert.equal(x.overviewEn, "EN cap"); assert.equal(x.vote, 7);
  assert.deepEqual(x.providers, ["disney"]); assert.deepEqual(x.providersGuess, []);
  assert.equal(x.trailer, "capTrailer1"); assert.equal(x.fetchedAt, NOW);
  assert.equal(x.cands, undefined, "candidates are not published");
});

test("maps a season", async () => {
  const { data } = await run({ items: [S(1)], prev: null, fetchImpl: fake(), now: NOW, map });
  const x = data.items[0];
  assert.equal(x.name, "Loki"); assert.equal(x.nameHe, "לוקי"); assert.equal(x.season, 1);
  assert.equal(x.date, "2021-06-09"); assert.equal(x.episodes, 3); assert.equal(x.runtime, 95);
  assert.equal(x.poster, "https://image.tmdb.org/t/p/w342/loki-s1.jpg");
  assert.equal(x.overview, "תקציר לוקי"); assert.equal(x.overviewEn, "EN s1");
  assert.deepEqual(x.providers, ["disney"]); assert.deepEqual(x.providersGuess, ["disney"], "US Disney Plus = probably");
});

test("a movie with no Hebrew title has nameHe null", async () => {
  const f = fake(); const orig = f;
  const g = async url => { const r = await orig(url); if (String(url).includes("language=he-IL") && String(url).includes("/movie/")) return new Response(JSON.stringify({ id: 1771, title: movie.title, overview: "" })); return r; };
  const { data } = await run({ items: [M], prev: null, fetchImpl: g, now: NOW, map });
  assert.equal(data.items[0].nameHe, null);
  assert.equal(data.items[0].overview, null);
});

test("season trailer first, then the show's; a blocked one is skipped", async () => {
  const k = "K";
  const a = await run({ items: [S(1), S(2)], prev: null, fetchImpl: fake(), now: NOW, map, youtubeKey: k });
  assert.equal(a.data.items[0].trailer, "lokiS1Trlr1");
  assert.equal(a.data.items[1].trailer, "lokiShow001", "season 2 has no videos of its own");
  const b = await run({ items: [S(1)], prev: null, fetchImpl: fake({ blocked: ["lokiS1Trlr1"] }), now: NOW, map, youtubeKey: k });
  assert.equal(b.data.items[0].trailer, "lokiShow001");
});

test("a failed item keeps last night's data; a new failed item is left out", async () => {
  const first = await run({ items: [M], prev: null, fetchImpl: fake(), now: "2026-11-16T03:00:00Z", map });
  const items = [M, S(1), S(2), { ...M, id: "movie:1", tmdb: 1 }, { ...M, id: "movie:2", tmdb: 2 }, { ...M, id: "movie:3", tmdb: 3 }];
  const r = await run({ items, prev: first.data, fetchImpl: fake({ fail: new Set([1771]) }), now: NOW, map });
  assert.equal(r.abort, false);
  const kept = r.data.items.find(x => x.id === "movie:1771");
  assert.equal(kept.fetchedAt, "2026-11-16T03:00:00Z");
  assert.equal(kept.nameHe, "קפטן אמריקה: הנוקם הראשון");
  const lone = await run({ items: [M, S(1), S(2), { ...M, id: "movie:1", tmdb: 1 }, { ...M, id: "movie:2", tmdb: 2 }, { ...M, id: "movie:3", tmdb: 3 }], prev: null, fetchImpl: fake({ fail: new Set([1771]) }), now: NOW, map });
  assert.equal(lone.data.items.some(x => x.id === "movie:1771"), false);
});

test("more than 20% failed → abort", async () => {
  const r = await run({ items: [M, S(1), S(2)], prev: null, fetchImpl: fake({ fail: new Set([1771]) }), now: NOW, map });
  assert.equal(r.abort, true);
});

test("invalid rows are skipped with a warning, never abort", async () => {
  const r = await run({ items: [M, { ...S(1), era: "" }, S(2)], prev: null, fetchImpl: fake(), now: NOW, map });
  assert.equal(r.abort, false);
  assert.deepEqual(r.data.items.map(x => x.id), ["movie:1771", "tv:84958:s2"]);
  assert.equal(r.data.items[1].story_i, 2, "story_i is the row's place in mcu.json");
  assert.ok(r.warnings.some(w => /row 1/.test(w)));
});
