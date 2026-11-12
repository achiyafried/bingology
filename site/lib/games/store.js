import { addDays } from "./day.js";

const P = "bingology:games:";
const STREAK = P + "streak";
const PRACTICE = P + "practice";
const DAY_KEY = /^bingology:games:(\d{4}-\d{2}-\d{2})$/;

const isObj = v => v && typeof v === "object" && !Array.isArray(v);

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
}
function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/** Per-game states of a day: { [gameId]: state }. Never throws. */
export function loadDay(storage, date) {
  const v = read(storage, P + date);
  return isObj(v) ? v : {};
}

export function saveDay(storage, date, states) {
  write(storage, P + date, states);
}

/** Practice (yesterday's file) lives in one slot, replaced when the date differs. */
export function loadPractice(storage, date) {
  const v = read(storage, PRACTICE);
  return isObj(v) && v.date === date && isObj(v.states) ? v.states : {};
}

export function savePractice(storage, date, states) {
  write(storage, PRACTICE, { date, states });
}

function loadStreak(storage) {
  const v = read(storage, STREAK);
  return isObj(v) && typeof v.last === "string" && Number.isInteger(v.n) ? v : null;
}

/** Marks `date` as completed and returns the streak. Idempotent per date. */
export function markComplete(storage, date) {
  const s = loadStreak(storage);
  if (s && s.last === date) return s.n;
  const n = s && s.last === addDays(date, -1) ? s.n + 1 : 1;
  write(storage, STREAK, { last: date, n });
  return n;
}

/** Current streak: 0 unless the last completed day is today or yesterday. */
export function streak(storage, today) {
  const s = loadStreak(storage);
  return s && (s.last === today || s.last === addDays(today, -1)) ? s.n : 0;
}

/** Number of games finished on `date`. */
export function dayProgress(storage, date) {
  return Object.values(loadDay(storage, date)).filter(s => s && s.done === true).length;
}

/** Removes stored day states older than `keep` days. */
export function prune(storage, today, keep = 30) {
  try {
    const cutoff = addDays(today, -keep);
    const stale = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      const m = k && DAY_KEY.exec(k);
      if (m && m[1] < cutoff) stale.push(k);
    }
    stale.forEach(k => storage.removeItem(k));
  } catch (e) {}
}
