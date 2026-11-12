// blur: name the blurred actor in 5 guesses. Puzzle: { actor: {name,photo}, count, series: string[] }.
const MAX = 5;
const PX = [24, 16, 10, 5, 2];
const norm = s => String(s).trim().toLowerCase();

export function init() {
  return { guesses: [], done: false };
}

export function play(state, puzzle, move) {
  if (state.done || !move || typeof move.name !== "string" || !move.name.trim()) return state;
  const guesses = [...state.guesses, move.name.trim()];
  const hit = norm(move.name) === norm(puzzle.actor.name);
  return { guesses, done: hit || guesses.length >= MAX };
}

export function blurPx(state) {
  return state.done ? 0 : PX[Math.min(state.guesses.length, MAX - 1)];
}

/** One hint per miss: the series count, then the series names. */
export function hints(state, puzzle) {
  const out = [];
  for (let i = 0; i < state.guesses.length; i++) {
    if (i === 0) out.push(`${puzzle.count} סדרות במאגר`);
    else if (i - 1 < puzzle.series.length) out.push(puzzle.series[i - 1]);
  }
  return out;
}

export function result(state, puzzle) {
  const win = state.guesses.length > 0 && norm(state.guesses[state.guesses.length - 1]) === norm(puzzle.actor.name);
  return { done: state.done, win, score: win ? state.guesses.length : null,
    label: !state.done ? "" : win ? `${state.guesses.length}/${MAX}` : `X/${MAX}` };
}
