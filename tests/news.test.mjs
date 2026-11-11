import { test } from "node:test";
import assert from "node:assert/strict";
import { diffNews } from "../scripts/lib/news.mjs";

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
