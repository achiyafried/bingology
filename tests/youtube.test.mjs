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
