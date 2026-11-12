// odd: 3 rounds, pick the series the actor was not in. Puzzle: { rounds: [{ actor, series, odd }] }.
const ROUNDS = 3;

export function init() {
  return { picks: [], done: false };
}

export function play(state, puzzle, move) {
  if (state.done || !move || !Number.isInteger(move.index)) return state;
  const round = puzzle.rounds[state.picks.length];
  if (!round || move.index < 0 || move.index >= round.series.length) return state;
  const picks = [...state.picks, move.index];
  return { picks, done: picks.length >= puzzle.rounds.length };
}

/** Index of the round being played (0..2). */
export function round(state) {
  return Math.min(state.picks.length, ROUNDS - 1);
}

export function result(state, puzzle) {
  const score = state.picks.filter((p, i) => p === puzzle.rounds[i].odd).length;
  const n = puzzle.rounds.length;
  return { done: state.done, win: state.done && score >= 2, score, label: state.done ? `${score}/${n}` : "" };
}
