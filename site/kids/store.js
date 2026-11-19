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

/** The saved game of `age` on `date`, or null when missing, broken, or for another puzzle. */
export function loadGame(storage, date, age, answer) {
  const day = read(storage, GAME(date));
  const g = day && typeof day === "object" ? day[age] : null;
  return g && g.answer === answer && Array.isArray(g.misses) && typeof g.done === "boolean" ? g : null;
}

export function saveGame(storage, date, age, state) {
  const day = read(storage, GAME(date));
  write(storage, GAME(date), { ...(day && typeof day === "object" ? day : {}), [age]: state });
}
