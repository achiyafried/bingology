// chain: walk from series `from` to `to` through shared actors. Puzzle: { from, to, shortest, limit, series }.
export function init(puzzle) {
  return { path: [puzzle.from], via: [], steps: 0, done: false };
}

const cur = s => s.path[s.path.length - 1];

export function play(state, puzzle, move) {
  if (state.done || !move) return state;
  if (move.type === "back") {
    if (state.path.length < 2) return state;
    return { ...state, path: state.path.slice(0, -1), via: state.via.slice(0, -1) };
  }
  if (move.type !== "step") return state;
  const from = puzzle.series[String(cur(state))];
  const to = puzzle.series[String(move.to)];
  if (!from || !to || String(move.to) === String(cur(state))) return state;
  if (!from.cast.includes(move.actor) || !to.cast.includes(move.actor)) return state;
  const path = [...state.path, move.to];
  const steps = state.steps + 1;
  const arrived = String(move.to) === String(puzzle.to);
  return { path, via: [...state.via, move.actor], steps, done: arrived || steps >= puzzle.limit };
}

export function result(state, puzzle) {
  const win = state.done && String(cur(state)) === String(puzzle.to);
  const label = !state.done ? "" : !win ? "נתקעת" : state.steps === puzzle.shortest ? "מושלם" : "הצלחה";
  return { done: state.done, win, score: state.steps, label };
}
