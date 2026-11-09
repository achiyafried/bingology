import { test } from "node:test";
import assert from "node:assert/strict";
import { quizSteps } from "../site/lib/quiz.js";

const QS = [{ id: "src" }, { id: "platforms" }, { id: "genres" }];

test("the services question is dropped when no series has streaming info", () => {
  const S = [{ providers: [] }, { providers: [] }];
  assert.deepEqual(quizSteps(QS, S).map(q => q.id), ["src", "genres"]);
});

test("the services question stays when any series has streaming info", () => {
  const S = [{ providers: [] }, { providers: ["netflix"] }];
  assert.deepEqual(quizSteps(QS, S).map(q => q.id), ["src", "platforms", "genres"]);
});
