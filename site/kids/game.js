// "Which series is hiding?": a blurred poster and up to 4 choices. One puzzle per day per age group, picked in the browser.
import { inGroup } from "./catalog.js";

export const MAX_MISSES = 3;
export const PX = [28, 18, 10, 0]; // blur by misses

/** FNV-1a: a stable 32-bit number for a string. */
export function seed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's puzzle for a group: { answer, choices } (tmdb ids), or null with fewer than 2 series with posters. */
export function puzzleFor(items, date, age) {
  const pool = inGroup(items, age).filter(x => x.poster).map(x => x.tmdb).sort((a, b) => a - b);
  if (pool.length < 2) return null;
  const s = seed(`${date}:${age}`);
  const rnd = mulberry32(s);
  const answer = pool[s % pool.length];
  const rest = pool.filter(id => id !== answer);
  const others = [], k = Math.min(3, rest.length);
  while (others.length < k) others.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  const choices = [answer, ...others];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { answer, choices };
}

export const initGame = puzzle => ({ answer: puzzle.answer, choices: puzzle.choices, misses: [], done: false, won: false });

export function guess(state, tmdb) {
  if (state.done || !state.choices.includes(tmdb) || state.misses.includes(tmdb)) return state;
  if (tmdb === state.answer) return { ...state, done: true, won: true };
  const misses = [...state.misses, tmdb];
  const wrongLeft = state.choices.length - 1 - misses.length;
  return { ...state, misses, done: misses.length >= MAX_MISSES || wrongLeft === 0 };
}

export const blur = state => (state.done ? 0 : PX[state.misses.length]);
export const outcome = state => (!state.done ? null : state.won ? "win" : "lose");
