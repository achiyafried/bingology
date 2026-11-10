import { test } from "node:test";
import assert from "node:assert/strict";
import { quizSteps, resetQuiz, orderResults, emptyPlatforms, ALWAYS_SHOWN } from "../site/lib/quiz.js";

const QS = [{ id: "src" }, { id: "platforms" }, { id: "genres" }];

test("the services question is dropped when no series has streaming info", () => {
  const S = [{ providers: [] }, { providers: [] }];
  assert.deepEqual(quizSteps(QS, S).map(q => q.id), ["src", "genres"]);
});

test("the services question stays when any series has streaming info", () => {
  const S = [{ providers: [] }, { providers: ["netflix"] }];
  assert.deepEqual(quizSteps(QS, S).map(q => q.id), ["src", "platforms", "genres"]);
});

test("resetQuiz clears answers and the recommendation but keeps seen marks", () => {
  const st = { tab: "pick", screen: "result", step: 9, ans: { mood: "tense", genres: ["crime"] }, touched: { mood: true },
    ranked: [{ i: 1 }], idx: 2, chosen: true, surprise: true, seen: new Set([3]) };
  resetQuiz(st, { mood: null, genres: [] });
  assert.equal(st.screen, "intro"); assert.equal(st.tab, "pick"); assert.equal(st.step, 0);
  assert.deepEqual(st.ans, { mood: null, genres: [] }); assert.deepEqual(st.touched, {});
  assert.deepEqual(st.ranked, []); assert.equal(st.idx, 0); assert.equal(st.chosen, false); assert.equal(st.surprise, false);
  assert.deepEqual([...st.seen], [3]);
});

const SY = [{ y: 2010 }, { y: 1999 }, { y: 2022 }, { y: null }, { y: 2005 }];
const ranked = [{ i: 0, sc: 0.9 }, { i: 1, sc: 0.8 }, { i: 2, sc: 0.7 }, { i: 3, sc: 0.6 }, { i: 4, sc: 0.5 }];

test("orderResults by match keeps the ranking", () => {
  assert.deepEqual(orderResults(ranked, SY, "match").map(r => r.i), [0, 1, 2, 3, 4]);
});

test("orderResults oldest/newest sorts the top matches by year, unknown years last", () => {
  assert.deepEqual(orderResults(ranked, SY, "old").map(r => r.i), [1, 4, 0, 2, 3]);
  assert.deepEqual(orderResults(ranked, SY, "new").map(r => r.i), [2, 0, 4, 1, 3]);
});

test("orderResults only reorders the 10 best matches", () => {
  const many = Array.from({ length: 12 }, (_, k) => ({ i: k, sc: 1 - k / 100 }));
  const S12 = Array.from({ length: 12 }, (_, k) => ({ y: 2020 - k }));
  const out = orderResults(many, S12, "old").map(r => r.i);
  assert.deepEqual(out.slice(0, 10), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(out.slice(10), [10, 11]);
});

test("orderResults includes every series tied with the 10th best match", () => {
  const many = Array.from({ length: 14 }, (_, k) => ({ i: k, sc: 1 - k / 1000, pct: k < 12 ? 100 : 80 }));
  const S14 = Array.from({ length: 14 }, (_, k) => ({ y: 2000 + k }));
  const out = orderResults(many, S14, "new").map(r => r.i);
  assert.deepEqual(out.slice(0, 12), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(out.slice(12), [12, 13]);
});

test("orderResults by score sorts the best matches by binge score, unknown last", () => {
  const S5 = [{ bs: 70 }, { bs: 95 }, { bs: null }, { bs: 80 }, { bs: 60 }];
  assert.deepEqual(orderResults(ranked, S5, "score").map(r => r.i), [1, 3, 0, 4, 2]);
});

test("the Israeli services are always offered", () => {
  assert.deepEqual(ALWAYS_SHOWN, ["yes", "hot", "partner", "cellcom", "kan"]);
});

test("emptyPlatforms lists chosen services that have no series", () => {
  const S = [{ providers: ["netflix", "yes"] }, { providers: [] }];
  assert.deepEqual(emptyPlatforms(S, ["hot", "netflix", "kan"]), ["hot", "kan"]);
  assert.deepEqual(emptyPlatforms(S, ["yes"]), []);
  assert.deepEqual(emptyPlatforms(S, []), []);
});
