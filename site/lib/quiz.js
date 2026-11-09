/** The quiz questions to ask for this data: skip "which services" when no series has streaming info. */
export function quizSteps(qs, S) {
  const anyProviders = S.some(s => s.providers && s.providers.length);
  return anyProviders ? qs : qs.filter(q => q.id !== "platforms");
}
