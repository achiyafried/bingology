// The kids page's saved choices: the age group and today's game per group. Storage may be missing or throw.
const AGE_KEY = "bingology:kids-age";
const GAME = date => `bingology:kids-game:${date}`;
const AGES = ["small", "mid", "big"];

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}
function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

export function loadAge(storage) {
  const v = read(storage, AGE_KEY);
  return AGES.includes(v) ? v : "mid";
}
export const saveAge = (storage, age) => write(storage, AGE_KEY, age);

const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && b.every(x => a.includes(x));

/** The saved game of `age` on `date`, or null when missing, broken, or for another puzzle (answer or choices differ). */
export function loadGame(storage, date, age, puzzle) {
  const day = read(storage, GAME(date));
  const g = day && typeof day === "object" ? day[age] : null;
  return g && g.answer === puzzle.answer && sameSet(g.choices, puzzle.choices)
    && Array.isArray(g.misses) && typeof g.done === "boolean" ? g : null;
}

export function saveGame(storage, date, age, state) {
  const day = read(storage, GAME(date));
  write(storage, GAME(date), { ...(day && typeof day === "object" ? day : {}), [age]: state });
}

const LEVEL = game => `bingology:kids-level:${game}`;
const MUTE_KEY = "bingology:kids-mute";
const SCENE = place => `bingology:kids-scene:${place}`;

/** Completed rounds of a game ("puzzle" | "memory"); a non-negative integer, else 0. */
export function loadLevel(storage, game) {
  const v = read(storage, LEVEL(game));
  return Number.isInteger(v) && v >= 0 ? v : 0;
}
export const bumpLevel = (storage, game) => write(storage, LEVEL(game), loadLevel(storage, game) + 1);

export const loadMute = storage => read(storage, MUTE_KEY) === true;
export const saveMute = (storage, on) => write(storage, MUTE_KEY, !!on);

const unit = n => typeof n === "number" && n >= 0 && n <= 1;

/** Stickers placed in a scene, as [{tmdb,x,y}]; drops entries with a non-integer tmdb or x/y outside 0-1. */
export function loadScene(storage, place) {
  const v = read(storage, SCENE(place));
  return Array.isArray(v) ? v.filter(e => e && Number.isInteger(e.tmdb) && unit(e.x) && unit(e.y)).map(e => ({ tmdb: e.tmdb, x: e.x, y: e.y })) : [];
}
export const saveScene = (storage, place, list) => write(storage, SCENE(place), list);
export function clearScene(storage, place) {
  try { storage.removeItem(SCENE(place)); } catch {}
}

const SIZE = "bingology:kids-puzzle-size";
const SIZES = [4, 6, 9, 12, 16, 20];
/** The last puzzle size picked: one of the six level sizes, default 4. */
export function loadPuzzleSize(storage) {
  const v = read(storage, SIZE);
  return SIZES.includes(v) ? v : 4;
}
export const savePuzzleSize = (storage, n) => write(storage, SIZE, n);

const MEM_SIZE = "bingology:kids-memory-size";
const MEM_SIZES = [4, 6, 8, 12, 16, 20];
/** The last memory size picked (cards): one of the six, default 6. */
export function loadMemorySize(storage) {
  const v = read(storage, MEM_SIZE);
  return MEM_SIZES.includes(v) ? v : 6;
}
export const saveMemorySize = (storage, n) => write(storage, MEM_SIZE, n);

// Who plays the toddler games: [{ name, g: "m" | "f" }], saved on this device only.
const PLAYERS = "bingology:kids-players";
const PLAYER = "bingology:kids-player";
const NONAME = "bingology:kids-noname";
export function loadPlayers(storage) {
  const v = read(storage, PLAYERS);
  return (Array.isArray(v) ? v : [])
    .filter(p => p && typeof p.name === "string" && p.name.trim() && (p.g === "m" || p.g === "f"))
    .map(p => ({ name: p.name, g: p.g })).slice(0, 4);
}
export const savePlayers = (storage, list) => write(storage, PLAYERS, list);
export function loadPlayer(storage) {
  const v = read(storage, PLAYER);
  return Number.isInteger(v) && v >= 0 ? v : 0;
}
export const savePlayer = (storage, i) => write(storage, PLAYER, i);
export const loadNoName = storage => read(storage, NONAME) === true;
export const saveNoName = (storage, on) => write(storage, NONAME, on);
