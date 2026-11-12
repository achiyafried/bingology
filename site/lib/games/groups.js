// groups: find four groups of four. Puzzle: { items, groups: [{ ids: [4], ... }] }.
const MAX_MISTAKES = 4;
const key = ids => [...ids].map(String).sort().join(",");

export function init() {
  return { solved: [], mistakes: 0, tried: [], last: null, done: false };
}

export function play(state, puzzle, move) {
  if (state.done || !move || !Array.isArray(move.ids)) return state;
  const picked = new Set(move.ids.map(String));
  if (move.ids.length !== 4 || picked.size !== 4) return state;
  const valid = new Set(puzzle.items.map(i => String(i.id)));
  if (![...picked].every(id => valid.has(id))) return state;
  const k = key(picked);
  const hit = puzzle.groups.findIndex((g, i) => !state.solved.includes(i) && key(g.ids) === k);
  if (hit >= 0) {
    const solved = [...state.solved, hit];
    return { ...state, solved, last: "ok", done: solved.length === puzzle.groups.length };
  }
  if (state.tried.includes(k)) return { ...state, last: "repeat" };
  const mistakes = state.mistakes + 1;
  const close = puzzle.groups.some((g, i) =>
    !state.solved.includes(i) && g.ids.filter(id => picked.has(String(id))).length === 3);
  return { ...state, mistakes, tried: [...state.tried, k], last: close ? "one-away" : "wrong", done: mistakes >= MAX_MISTAKES };
}

export function result(state, puzzle) {
  const win = state.done && state.solved.length === puzzle.groups.length;
  const m = state.mistakes;
  const label = !state.done ? "" : !win ? "X" : m === 1 ? "1 טעות" : `${m} טעויות`;
  return { done: state.done, win, score: m, label };
}
