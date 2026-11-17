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
    if (/\/aggregate_credits$/.test(u.pathname)) return new Response(JSON.stringify({ cast: [] }));
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

import { castOf, appearances } from "../scripts/lib/mcu.mjs";

test("castOf: movie credits and season aggregate roles, only the people we follow", () => {
  const keep = new Set([1, 2]);
  assert.deepEqual(castOf({ cast: [{ id: 1, name: "A", character: "Steve Rogers / Captain America" }, { id: 9, name: "Z", character: "x" }] }, keep),
    [{ person: 1, name: "A", character: "Steve Rogers / Captain America" }]);
  assert.deepEqual(castOf({ cast: [{ id: 2, name: "B", roles: [{ character: "Bruce Banner" }, { character: "Smart Hulk" }] }] }, keep),
    [{ person: 2, name: "B", character: "Bruce Banner / Smart Hulk" }]);
  assert.deepEqual(castOf(null, keep), []);
});

test("appearances: actor AND character must match; two actors, one character; cameo; none → left out", () => {
  const items = [
    { id: "movie:1", story_i: 0, poster: "P1", cast: [{ person: 16828, name: "Chris Evans", character: "Steve Rogers / Captain America" }, { person: 819, name: "Edward Norton", character: "Bruce Banner" }] },
    { id: "movie:2", story_i: 1, poster: "P2", cast: [{ person: 16828, name: "Chris Evans", character: "Johnny Storm / Human Torch" }, { person: 103, name: "Mark Ruffalo", character: "Bruce Banner (uncredited)" }] },
  ];
  const chars = [
    { id: "captain-america", he: "קפטן אמריקה", en: "Captain America", people: [16828], match: "Steve Rogers|Captain America", poster: "movie:1" },
    { id: "hulk", he: "האלק", en: "Hulk", people: [819, 103], match: "Banner|Hulk", poster: "movie:2" },
    { id: "nobody", he: "אף אחד", en: "Nobody", people: [5], match: "x", poster: "movie:1" },
  ];
  const warnings = [];
  const out = appearances(chars, items, warnings);
  assert.deepEqual(out.map(c => c.id), ["hulk", "captain-america"], "most appearances first");
  const hulk = out[0];
  assert.deepEqual(hulk.apps, [{ id: "movie:1", as: "Bruce Banner", cameo: false }, { id: "movie:2", as: "Bruce Banner", cameo: true }]);
  assert.equal(hulk.actor, "Mark Ruffalo", "the latest actor");
  assert.equal(hulk.poster, "P2");
  assert.deepEqual(out[1].apps.map(a => a.id), ["movie:1"], "Johnny Storm is not Captain America");
  assert.ok(warnings.some(w => /nobody/.test(w)));
});

test("run: characters come out of the fetch; season cast from aggregate_credits", async () => {
  const f = fake();
  const g = async url => {
    const u = new URL(url);
    if (/\/aggregate_credits$/.test(u.pathname)) return new Response(JSON.stringify({ cast: [{ id: 91606, name: "Tom Hiddleston", roles: [{ character: "Loki" }] }] }));
    if (/\/movie\/1771$/.test(u.pathname) && u.searchParams.get("language") === "en-US") return new Response(JSON.stringify({ ...movie, credits: { cast: [{ id: 16828, name: "Chris Evans", character: "Steve Rogers / Captain America" }] } }));
    return f(url);
  };
  const characters = [
    { id: "captain-america", he: "קפטן אמריקה", en: "Captain America", people: [16828], match: "Steve Rogers", poster: "movie:1771" },
    { id: "loki", he: "לוקי", en: "Loki", people: [91606], match: "Loki", poster: "tv:84958:s1" },
  ];
  const { data } = await run({ items: [M, S(1)], prev: null, fetchImpl: g, now: NOW, map, characters });
  assert.deepEqual(data.characters.map(c => [c.id, c.apps.length, c.actor]), [["loki", 1, "Tom Hiddleston"], ["captain-america", 1, "Chris Evans"]], "ties in Hebrew order");
  assert.equal(data.characters.find(c => c.id === "loki").poster, "https://image.tmdb.org/t/p/w342/loki-s1.jpg");
  assert.deepEqual(data.items[0].cast, [{ person: 16828, name: "Chris Evans", character: "Steve Rogers / Captain America" }]);
});

test("run: a failed item keeps yesterday's cast", async () => {
  const characters = [{ id: "captain-america", he: "ק", en: "C", people: [16828], match: "Steve", poster: "movie:1771" }];
  const prev = { items: [{ ...M, story_i: 0, name: "Cap", fetchedAt: "2026-11-16T03:00:00Z", cast: [{ person: 16828, name: "Chris Evans", character: "Steve Rogers" }] }] };
  const items = [M, ...[1, 2, 3, 4, 5].map(n => ({ ...M, id: `movie:${n}`, tmdb: n }))];
  const r = await run({ items, prev, fetchImpl: fake({ fail: new Set([1771]) }), now: NOW, map, characters });
  assert.deepEqual(r.data.characters.find(c => c.id === "captain-america").apps.map(a => a.id), ["movie:1771"]);
});

test("only the season credits failing: the item is fine and keeps yesterday's cast", async () => {
  const f = fake();
  const g = async url => (/\/aggregate_credits$/.test(new URL(url).pathname) ? new Response("{}", { status: 500 }) : f(url));
  const characters = [{ id: "loki", he: "לוקי", en: "Loki", people: [91606], match: "Loki", poster: "tv:84958:s1" }];
  const prev = { items: [{ ...S(1), story_i: 0, fetchedAt: "2026-11-16T03:00:00Z", cast: [{ person: 91606, name: "Tom Hiddleston", character: "Loki" }] }] };
  const r = await run({ items: [S(1)], prev, fetchImpl: g, now: NOW, map, characters });
  assert.equal(r.failed, 0);
  assert.equal(r.data.items[0].fetchedAt, NOW);
  assert.deepEqual(r.data.items[0].cast, prev.items[0].cast);
  assert.equal(r.data.characters[0].apps.length, 1);
});

test("a bad character row is skipped with a warning, never crashes the run", async () => {
  const characters = [{ id: "bad", he: "x", en: "x", people: [1], match: "(", poster: "movie:1771" }, { id: "cap", he: "ק", en: "C", people: [16828], match: "Steve", poster: "movie:1771" }];
  const r = await run({ items: [M], prev: null, fetchImpl: fake(), now: NOW, map, characters });
  assert.ok(r.warnings.some(w => /mcu-characters\.json row 0/.test(w)));
});
