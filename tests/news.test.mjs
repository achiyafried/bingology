import { test } from "node:test";
import assert from "node:assert/strict";
import { diffNews, mergeNews, buildNews, writeNews } from "../scripts/lib/news.mjs";

const NOW = "2026-11-12T03:00:00Z";
const S = (o = {}) => ({ tmdbId: 95396, seasons: 2, status: "airing", next: null,
  streams: { IL: [], US: [], UK: [] }, fetchedAt: NOW, ...o });
const P = (o = {}) => S({ fetchedAt: "2026-11-11T03:00:00Z", ...o });

test("announced: new next with episode 1 and a new season", () => {
  const items = diffNews([P()], [S({ next: { season: 3, episode: 1, date: "2027-03-14" } })], NOW);
  assert.deepEqual(items, [{ id: "95396-announced-3-2027-03-14", date: "2026-11-12", tmdbId: 95396,
    kind: "announced", season: 3, airDate: "2027-03-14" }]);
});

test("announced: same next twice is silent, changed date is new", () => {
  const next = { season: 3, episode: 1, date: "2027-03-14" };
  assert.deepEqual(diffNews([P({ next })], [S({ next })], NOW), []);
  const items = diffNews([P({ next })], [S({ next: { ...next, date: "2027-04-01" } })], NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "95396-announced-3-2027-04-01");
});

test("premiere: seasons rose after next S5E1 came due", () => {
  const items = diffNews(
    [P({ seasons: 4, next: { season: 5, episode: 1, date: "2026-11-12" } })], [S({ seasons: 5 })], NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "premiere");
  assert.equal(items[0].season, 5);
  assert.equal(items[0].id, "95396-premiere-5");
});

test("premiere: season 1 never counts", () => {
  assert.deepEqual(diffNews([P({ seasons: 0 })], [S({ seasons: 1 })], NOW), []);
  assert.deepEqual(
    diffNews([P({ seasons: 0, next: { season: 1, episode: 1, date: "2026-11-12" } })], [S({ seasons: 1 })], NOW), []);
});

test("ended and canceled", () => {
  assert.deepEqual(diffNews([P()], [S({ status: "ended" })], NOW).map((i) => [i.kind, i.id]),
    [["ended", "95396-ended"]]);
  assert.deepEqual(diffNews([P()], [S({ status: "canceled" })], NOW).map((i) => [i.kind, i.id]),
    [["canceled", "95396-canceled"]]);
});

test("stream added and removed", () => {
  const added = diffNews([P()], [S({ streams: { IL: [], US: [], UK: ["Sky Go"] } })], NOW);
  assert.deepEqual(added, [{ id: "95396-stream_added-UK-Sky Go", date: "2026-11-12", tmdbId: 95396,
    kind: "stream_added", region: "UK", provider: "Sky Go" }]);
  const removed = diffNews([P({ streams: { IL: ["Netflix"], US: [], UK: [] } })], [S()], NOW);
  assert.deepEqual(removed, [{ id: "95396-stream_removed-IL-Netflix", date: "2026-11-12", tmdbId: 95396,
    kind: "stream_removed", region: "IL", provider: "Netflix" }]);
});

test("no news: first run, one-sided series, failed fetch, missing prev fields", () => {
  const next = { season: 3, episode: 1, date: "2027-03-14" };
  assert.deepEqual(diffNews([], [S({ next, status: "ended" })], NOW), []);
  assert.deepEqual(diffNews([P()], [S({ tmdbId: 2, next })], NOW), []);
  assert.deepEqual(diffNews([P({ tmdbId: 2 })], [S({ next })], NOW), []);
  assert.deepEqual(diffNews([P()], [S({ next, status: "ended", fetchedAt: "2026-11-11T03:00:00Z" })], NOW), []);
  const old = P(); delete old.next; delete old.streams;
  assert.deepEqual(diffNews([old], [S({ next, streams: { IL: ["X"], US: [], UK: [] } })], NOW), []);
});

const N3 = "2026-11-13T03:00:00Z";
const it = (id, date, extra = {}) => ({ id, date, tmdbId: 1, kind: "ended", ...extra });
const sr = (kind, date, region = "IL", provider = "Netflix") =>
  ({ id: `1-${kind}-${region}-${provider}`, date, tmdbId: 1, kind, region, provider });

test("merge: new first, duplicate ids dropped, null prev starts empty", () => {
  const prev = { updatedAt: "x", items: [it("a", "2026-11-10")] };
  const r = mergeNews(prev, [it("b", "2026-11-13"), it("a", "2026-11-13")], N3);
  assert.deepEqual(r.items.map((i) => i.id), ["b", "a"]);
  assert.equal(r.updatedAt, N3);
  assert.deepEqual(mergeNews(null, [], N3), { updatedAt: N3, items: [] });
});

test("merge: 60-day window and 400 cap", () => {
  const old = it("old", "2026-09-01");
  const edge = it("edge", "2026-09-14");
  const r = mergeNews({ items: [edge, old] }, [], N3);
  assert.deepEqual(r.items.map((i) => i.id), ["edge"]);
  const many = Array.from({ length: 450 }, (_, i) => it(`n${i}`, "2026-11-13"));
  const m = mergeNews(null, many, N3);
  assert.equal(m.items.length, 400);
  assert.equal(m.items[0].id, "n0");
});

test("merge: flap pairs within 7 days vanish, in both orders", () => {
  const a = mergeNews({ items: [sr("stream_removed", "2026-11-10")] }, [sr("stream_added", "2026-11-13")], N3);
  assert.deepEqual(a.items, []);
  const b = mergeNews({ items: [sr("stream_added", "2026-11-10")] }, [sr("stream_removed", "2026-11-13")], N3);
  assert.deepEqual(b.items, []);
  const c = mergeNews({ items: [sr("stream_removed", "2026-11-05")] }, [sr("stream_added", "2026-11-13")], N3);
  assert.equal(c.items.length, 2);
  const d = mergeNews({ items: [sr("stream_removed", "2026-11-10", "US")] }, [sr("stream_added", "2026-11-13")], N3);
  assert.equal(d.items.length, 2);
});

test("buildNews: changed flag", () => {
  const S = (o) => ({ tmdbId: 1, seasons: 1, status: "airing", next: null, streams: { IL: [], US: [], UK: [] }, ...o });
  const prevData = [S({ fetchedAt: "2026-11-12T03:00:00Z" })];
  const same = buildNews(prevData, [S({ fetchedAt: N3 })], { updatedAt: "x", items: [] }, N3);
  assert.equal(same.changed, false);
  const diff = buildNews(prevData, [S({ fetchedAt: N3, status: "ended" })], null, N3);
  assert.equal(diff.changed, true);
  assert.equal(diff.news.items[0].kind, "ended");
});

test("no news from a stale yesterday row left by a failed fetch", () => {
  const next = { season: 3, episode: 1, date: "2027-03-14" };
  const stale = P({ fetchedAt: "2026-11-10T03:00:00Z", next: null, streams: null });
  const other = P({ tmdbId: 2 });
  const curr = S({ next, streams: { IL: ["Netflix"], US: [], UK: [] } });
  assert.deepEqual(diffNews([stale, other], [curr], NOW), []);
});

test("fresh yesterday row with no next still announces", () => {
  const items = diffNews([P({ next: null }), P({ tmdbId: 2 })],
    [S({ next: { season: 3, episode: 1, date: "2027-03-14" } })], NOW);
  assert.deepEqual(items.map((i) => i.kind), ["announced"]);
});

test("fresh yesterday streams null gives no stream items", () => {
  assert.deepEqual(diffNews([P({ streams: null })], [S({ streams: { IL: ["X"], US: [], UK: [] } })], NOW), []);
});

test("premiere from seasons rising alone", () => {
  const items = diffNews([P({ seasons: 4 })], [S({ seasons: 5 })], NOW);
  assert.deepEqual(items.map((i) => [i.kind, i.season]), [["premiere", 5]]);
});

test("flap at exactly 7 days is removed", () => {
  const r = mergeNews({ items: [sr("stream_removed", "2026-11-06")] }, [sr("stream_added", "2026-11-13")], N3);
  assert.deepEqual(r.items, []);
});

// writeNews: fs injected; news failure must never throw
const WS = (o = {}) => ({ tmdbId: 1, seasons: 1, status: "airing", next: null, streams: { IL: [], US: [], UK: [] }, ...o });
const wdata = (o) => ({ series: [WS({ fetchedAt: "2026-11-12T03:00:00Z", ...o })] });
const wprev = () => ({ series: [WS({ fetchedAt: "2026-11-11T03:00:00Z" })] });

test("writeNews: corrupt previous news.json warns once and starts empty", () => {
  const warns = [], writes = [];
  writeNews({ prevData: wprev(), data: wdata({ status: "ended" }), newsPath: "n.json", now: NOW,
    read: () => "{oops", write: (p, s) => writes.push([p, s]), warn: (m) => warns.push(m) });
  assert.equal(warns.length, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "n.json");
  const out = JSON.parse(writes[0][1]);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].kind, "ended");
});

test("writeNews: buildNews failure warns, writes nothing, does not throw", () => {
  const warns = [], writes = [];
  assert.doesNotThrow(() => writeNews({ prevData: wprev(), data: null, newsPath: "n.json", now: NOW,
    read: () => null, write: (...a) => writes.push(a), warn: (m) => warns.push(m) }));
  assert.ok(warns.length >= 1);
  assert.equal(writes.length, 0);
});

test("writeNews: unchanged does not write", () => {
  const writes = [];
  writeNews({ prevData: wprev(), data: wdata(), newsPath: "n.json", now: NOW,
    read: () => JSON.stringify({ updatedAt: "x", items: [] }), write: (...a) => writes.push(a), warn: () => {} });
  assert.equal(writes.length, 0);
});

test("writeNews: missing news.json and no items writes nothing", () => {
  const writes = [];
  writeNews({ prevData: wprev(), data: wdata(), newsPath: "n.json", now: NOW,
    read: () => null, write: (...a) => writes.push(a), warn: () => {} });
  assert.equal(writes.length, 0);
});

test("writeNews: a throwing write only warns", () => {
  const warns = [];
  assert.doesNotThrow(() => writeNews({ prevData: wprev(), data: wdata({ status: "ended" }), newsPath: "n.json", now: NOW,
    read: () => null, write: () => { throw new Error("EACCES"); }, warn: (m) => warns.push(m) }));
  assert.equal(warns.length, 1);
});
