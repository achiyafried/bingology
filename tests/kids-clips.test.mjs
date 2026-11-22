import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadsId, isoSeconds, clipOk, seriesClips } from "../scripts/lib/youtube.mjs";

const vid = (id, sec = 120, extra = {}) => ({ id, status: { embeddable: true, privacyStatus: "public", uploadStatus: "processed", madeForKids: true },
  contentDetails: { duration: `PT${sec}S` }, ...extra });
const vidId = (ch, n) => `${ch}${String(n).padStart(10, "0")}`.slice(0, 11);

/** channels: { UCa: [{id,title}...] } served in pages of `pageSize`; videos from `videos` map (default 120 s). */
function fake({ channels, pageSize = 50, endless = false, videos = {}, status = 200 }) {
  const calls = [];
  const fetchImpl = async url => {
    url = new URL(url);
    calls.push(url);
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    if (url.pathname.endsWith("/playlistItems")) {
      const pl = url.searchParams.get("playlistId");
      const list = channels["UC" + pl.slice(2)] ?? [];
      const at = Number(url.searchParams.get("pageToken") ?? 0);
      const slice = endless ? list.slice(0, pageSize) : list.slice(at, at + pageSize);
      const more = endless || at + pageSize < list.length;
      return { ok: true, status: 200, json: async () => ({ items: slice.map(i => ({ snippet: { title: i.title, resourceId: { videoId: i.id } } })),
        ...(more ? { nextPageToken: String(at + pageSize) } : {}) }) };
    }
    const ids = url.searchParams.get("id").split(",");
    return { ok: true, status: 200, json: async () => ({ items: ids.map(id => videos[id] ?? vid(id)) }) };
  };
  return { calls, fetchImpl };
}
const eps = (ch, n, name = "Bluey") => Array.from({ length: n }, (_, i) => ({ id: vidId(ch, i), title: `${name} | ep ${i}` }));
const pl = c => c.filter(u => u.pathname.endsWith("/playlistItems"));

test("uploadsId swaps the prefix", () => {
  assert.equal(uploadsId("UCabc123"), "UUabc123");
});
test("isoSeconds parses and rejects junk", () => {
  assert.equal(isoSeconds("PT7M3S"), 423);
  assert.equal(isoSeconds("PT1H"), 3600);
  assert.equal(isoSeconds("junk"), 0);
  assert.equal(isoSeconds(undefined), 0);
});
test("clipOk keeps 61s–12min only", () => {
  assert.equal(clipOk(vid("a", 60)), false);
  assert.equal(clipOk(vid("a", 61)), true);
  assert.equal(clipOk(vid("a", 720)), true);
  assert.equal(clipOk(vid("a", 721)), false);
  assert.equal(clipOk({ ...vid("a"), status: { ...vid("a").status, madeForKids: false } }), false);
  assert.equal(clipOk({ ...vid("a"), status: { ...vid("a").status, embeddable: false } }), false);
});
test("seriesClips fills from the first channel before the second", async () => {
  const f = fake({ channels: { UCA: eps("A", 20), UCB: eps("B", 20) } });
  const r = await seriesClips([{ channel: "UCA" }, { channel: "UCB" }], { key: "k", fetchImpl: f.fetchImpl });
  assert.equal(r.length, 12);
  assert.ok(r.every(c => c.id.startsWith("A")));
  assert.ok(f.calls.every(u => !u.searchParams.get("playlistId")?.includes("B")));
  assert.deepEqual(Object.keys(r[0]).sort(), ["id", "sec", "thumb", "title"]);
  assert.equal(r[0].thumb, `https://i.ytimg.com/vi/${r[0].id}/mqdefault.jpg`);
});
test("seriesClips tops up from the second channel", async () => {
  const f = fake({ channels: { UCA: eps("A", 2), UCB: eps("B", 20) } });
  const r = await seriesClips([{ channel: "UCA" }, { channel: "UCB" }], { key: "k", fetchImpl: f.fetchImpl });
  assert.equal(r.length, 12);
  assert.deepEqual(r.slice(0, 2).map(c => c.id[0]), ["A", "A"]);
  assert.ok(r.slice(2).every(c => c.id[0] === "B"));
});
test("seriesClips filters by match", async () => {
  const f = fake({ channels: { UCA: [{ id: "AAAAAAAAAAA", title: "Bluey | Fruit Bat" }, { id: "BBBBBBBBBBB", title: "Peppa Pig | Muddy" }] } });
  const r = await seriesClips([{ channel: "UCA", match: "Bluey" }], { key: "k", fetchImpl: f.fetchImpl });
  assert.deepEqual(r.map(c => c.id), ["AAAAAAAAAAA"]);
  const v = f.calls.find(u => u.pathname.endsWith("/videos"));
  assert.equal(v.searchParams.get("id"), "AAAAAAAAAAA");
});
test("seriesClips stops after 4 pages", async () => {
  const f = fake({ channels: { UCA: eps("A", 5, "Other") }, endless: true });
  const r = await seriesClips([{ channel: "UCA", match: "Bluey" }], { key: "k", fetchImpl: f.fetchImpl });
  assert.equal(r.length, 0);
  assert.equal(pl(f.calls).length, 4);
});
test("seriesClips throws on HTTP 403", async () => {
  const f = fake({ channels: { UCA: eps("A", 2) }, status: 403 });
  await assert.rejects(seriesClips([{ channel: "UCA" }], { key: "k", fetchImpl: f.fetchImpl }), /403/);
});
