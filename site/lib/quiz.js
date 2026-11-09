/** The quiz questions to ask for this data: skip "which services" when no series has streaming info. */
export function quizSteps(qs, S) {
  const anyProviders = S.some(s => s.providers && s.providers.length);
  return anyProviders ? qs : qs.filter(q => q.id !== "platforms");
}

/** Back to the home page with a clean quiz. "Already watched" marks are kept on purpose. */
export function resetQuiz(st, blank) {
  Object.assign(st, { tab: "pick", screen: "intro", step: 0, ans: blank, touched: {}, ranked: [], idx: 0, chosen: false, surprise: false });
}
