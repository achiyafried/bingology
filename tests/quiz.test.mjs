import { test } from "node:test";
import assert from "node:assert/strict";
import { quizSteps, resetQuiz } from "../site/lib/quiz.js";

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
