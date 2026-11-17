import { test } from "node:test";
import assert from "node:assert/strict";
import { playableIn, videoVerdicts } from "../scripts/lib/youtube.mjs";

const item = (id, o = {}) => ({ id, status: { embeddable: true, privacyStatus: "public", uploadStatus: "processed", ...o.status }, contentDetails: { ...o.cd } });

test("playableIn: embeddable, public, not blocked in the region, not age-restricted", () => {
  assert.equal(playableIn(item("a"), "IL"), true);
  assert.equal(playableIn(item("a", { status: { privacyStatus: "unlisted" } }), "IL"), true);
  assert.equal(playableIn(item("a", { status: { embeddable: false } }), "IL"), false);
  assert.equal(playableIn(item("a", { status: { privacyStatus: "private" } }), "IL"), false);
  assert.equal(playableIn(item("a", { status: { uploadStatus: "rejected" } }), "IL"), false);
  assert.equal(playableIn(item("a", { cd: { regionRestriction: { blocked: ["IL", "US"] } } }), "IL"), false);
  assert.equal(playableIn(item("a", { cd: { regionRestriction: { blocked: ["US"] } } }), "IL"), true);
  assert.equal(playableIn(item("a", { cd: { regionRestriction: { allowed: ["US", "CA"] } } }), "IL"), false);
  assert.equal(playableIn(item("a", { cd: { regionRestriction: { allowed: ["IL"] } } }), "IL"), true);
  assert.equal(playableIn(item("a", { cd: { contentRating: { ytRating: "ytAgeRestricted" } } }), "IL"), false);
});

test("videoVerdicts asks 50 ids per request, and a video missing from the answer is not playable", async () => {
  const ids = Array.from({ length: 51 }, (_, k) => "v" + String(k).padStart(10, "0"));
  const urls = [];
  const fetchImpl = async url => {
    urls.push(String(url));
    const asked = new URL(url).searchParams.get("id").split(",");
    return new Response(JSON.stringify({ items: asked.filter(id => id !== ids[3]).map(id => item(id)) }));
  };
  const v = await videoVerdicts(ids, { key: "K", region: "IL", fetchImpl });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?/);
  assert.equal(new URL(urls[0]).searchParams.get("part"), "status,contentDetails");
  assert.equal(new URL(urls[0]).searchParams.get("key"), "K");
  assert.equal(new URL(urls[0]).searchParams.get("id").split(",").length, 50);
  assert.equal(v.get(ids[0]), true);
  assert.equal(v.get(ids[3]), false);
  assert.equal(v.get(ids[50]), true);
});

test("videoVerdicts throws on an HTTP error (the caller keeps TMDB's order)", async () => {
  const fetchImpl = async () => new Response("{}", { status: 403 });
  await assert.rejects(videoVerdicts(["abcdefghijk"], { key: "K", region: "IL", fetchImpl }), /YouTube .*403/);
});

test("videoVerdicts with no ids makes no request", async () => {
  let n = 0;
  const v = await videoVerdicts([], { key: "K", region: "IL", fetchImpl: async () => { n++; } });
  assert.equal(n, 0); assert.equal(v.size, 0);
});

import { matchesTrailer, searchTrailers } from "../scripts/lib/youtube.mjs";

test("matchesTrailer: the series name and a trailer word in the title, never a movie", () => {
  assert.equal(matchesTrailer("The Office🎦Official Trailer ᴴᴰ [ TV Series 2005–2013 ]", "The Office (US)"), true);
  assert.equal(matchesTrailer("Official Trailer | The Office | Prime Video", "The Office (US)"), true);
  assert.equal(matchesTrailer("Survivor Official International Trailer #1 (2015) - Pierce Brosnan, Milla Jovovich Movie HD", "Survivor"), false);
  assert.equal(matchesTrailer("Survivor promo, 2000", "Survivor"), true);
  assert.equal(matchesTrailer("Dave Chappelle | Official Trailer [HD] | Netflix", "Chappelle’s Show"), false);
  assert.equal(matchesTrailer("Chappelle&#39;s Show - Black Bush (ft. Jamie Foxx)", "Chappelle’s Show"), false);
  assert.equal(matchesTrailer("Chappelle&#39;s Show | Official Teaser", "Chappelle’s Show"), true);
  assert.equal(matchesTrailer("Nathan For You | Season 3 Exclusive Trailer", "Nathan for You"), true);
  assert.equal(matchesTrailer("Nathan For You - Maid Service", "Nathan for You"), false);
  assert.equal(matchesTrailer("שטיסל - טריילר עונה 3", "שטיסל"), true);
  assert.equal(matchesTrailer("Dark Matter Trailer", "Dark"), true, "word match, not substring tricks");
  assert.equal(matchesTrailer("Darkness Trailer", "Dark"), false);
});

test("searchTrailers: one embeddable-in-IL video search, matching ids in result order", async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(new URL(url));
    return new Response(JSON.stringify({ items: [
      { id: { videoId: "aaaaaaaaaaa" }, snippet: { title: "Survivor Official Trailer (2015) Movie" } },
      { id: { videoId: "bbbbbbbbbbb" }, snippet: { title: "Survivor promo, 2000" } },
      { id: { videoId: "bad" }, snippet: { title: "Survivor trailer" } },
      { id: { videoId: "ccccccccccc" }, snippet: { title: "Survivor: Borneo (Season 1 Trailer)" } },
    ] }));
  };
  const ids = await searchTrailers({ name: "Survivor", year: 2000 }, { key: "K", region: "IL", fetchImpl });
  assert.deepEqual(ids, ["bbbbbbbbbbb", "ccccccccccc"]);
  const p = urls[0].searchParams;
  assert.equal(urls[0].origin + urls[0].pathname, "https://www.googleapis.com/youtube/v3/search");
  assert.equal(p.get("q"), "Survivor 2000 official trailer");
  assert.equal(p.get("type"), "video");
  assert.equal(p.get("videoEmbeddable"), "true");
  assert.equal(p.get("regionCode"), "IL");
  assert.equal(p.get("key"), "K");
});

test("searchTrailers throws on an HTTP error (quota, bad key)", async () => {
  await assert.rejects(searchTrailers({ name: "A", year: 2000 }, { key: "K", fetchImpl: async () => new Response("{}", { status: 403 }) }), /YouTube search .*403/);
});
