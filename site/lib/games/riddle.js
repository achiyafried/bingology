// riddle: a hand-written cryptic clue whose answer is a series' Hebrew title, filled in letter by letter.
// Puzzle: { clue, answer, words: [letters per word], tmdbId, explain? }.
const FINAL = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/** Hebrew letters of a string, final forms made regular; everything else (spaces, geresh, niqqud) dropped. */
export function letters(str) {
  return [...String(str || "")].filter(ch => /^[א-ת]$/.test(ch)).map(ch => FINAL[ch] || ch);
}

export function init() {
  return { letters: [], hints: 0, tries: 0, done: false, gaveUp: false };
}

// Every move starts from a copy without `last`, so a "wrong" marker lasts until the next change.
const next = (s, patch) => { const { last, ...rest } = s; return { ...rest, ...patch }; };

export function play(state, puzzle, move) {
  if (state.done || !move) return state;
  const want = letters(puzzle.answer), n = want.length;
  switch (move.type) {
    case "type": {
      const ch = letters(move.ch);
      if (ch.length !== 1 || [...String(move.ch)].length !== 1 || state.letters.length >= n) return state;
      return next(state, { letters: [...state.letters, ch[0]] });
    }
    case "del":
      if (state.letters.length <= state.hints) return state;
      return next(state, { letters: state.letters.slice(0, -1) });
    case "check": {
      if (state.letters.length < n) return state;
      if (state.letters.join("") === want.join("")) return next(state, { done: true });
      return { ...state, tries: state.tries + 1, last: "wrong" };
    }
    case "hint":
      if (state.hints >= n - 1) return state;
      return next(state, { hints: state.hints + 1, letters: want.slice(0, state.hints + 1) });
    case "reveal":
      return next(state, { done: true, gaveUp: true });
    default:
      return state;
  }
}

export function result(state) {
  if (!state.done) return { done: false, win: false, score: null, label: "" };
  if (state.gaveUp) return { done: true, win: false, score: null, label: "✗" };
  const h = state.hints;
  return { done: true, win: true, score: h, label: h === 0 ? "✓" : h === 1 ? "רמז 1" : `${h} רמזים` };
}
