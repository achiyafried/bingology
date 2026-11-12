// guess: up to 6 guesses, one more clue per miss. Puzzle: { answer: {id,name,poster}, clues: [...] }.
const MAX = 6;
const won = (s, p) => s.guesses.some(g => String(g) === String(p.answer.id));

export function init() {
  return { guesses: [], done: false };
}

export function play(state, puzzle, move) {
  if (state.done || !move || move.id == null) return state;
  if (state.guesses.some(g => String(g) === String(move.id))) return state;
  const guesses = [...state.guesses, move.id];
  const hit = String(move.id) === String(puzzle.answer.id);
  return { guesses, done: hit || guesses.length >= MAX };
}

/** Number of clues to show. */
export function revealed(state) {
  return state.done ? MAX : Math.min(state.guesses.length + 1, MAX);
}

export function result(state, puzzle) {
  const win = won(state, puzzle);
  const score = win ? state.guesses.length : null;
  return { done: state.done, win, score, label: !state.done ? "" : win ? `${score}/${MAX}` : `X/${MAX}` };
}
