// The riddle bank (riddles.json, written by hand) and its nightly assignment to the day files.
import fs from "node:fs";
import path from "node:path";
import { addDays } from "../../../site/lib/games/day.js";
import { letters } from "../../../site/lib/games/riddle.js";

const FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANSWER_RE = /^[א-ת]+( [א-ת]+)*$/;

export const riddleKey = r => `${r.tmdbId}:${r.answer}`;

/** The puzzle stored in a day file: letters per word, so the site can draw the boxes. */
export function toPuzzle(r) {
  const p = { clue: r.clue, answer: r.answer, words: r.answer.split(" ").map(w => letters(w).length), tmdbId: r.tmdbId };
  if (r.explain) p.explain = r.explain;
  return p;
}

const validDate = d => DATE_RE.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().startsWith(d);

/** Problems with one row's shape, or [] when it is fine. Whether the series is on the site is not checked here. */
function rowErrors(r, i) {
  if (!r || typeof r !== "object") return [`row ${i}: not an object`];
  const errs = [];
  if (typeof r.clue !== "string" || !r.clue.trim()) errs.push(`row ${i}: clue is missing`);
  if (typeof r.answer !== "string" || !ANSWER_RE.test(r.answer)) errs.push(`row ${i}: answer must be Hebrew letters with single spaces between words`);
  if (!Number.isInteger(r.tmdbId) || r.tmdbId <= 0) errs.push(`row ${i}: tmdbId must be a TMDB series number`);
  if (r.explain !== undefined && typeof r.explain !== "string") errs.push(`row ${i}: explain must be text`);
  if (r.date !== undefined && (typeof r.date !== "string" || !validDate(r.date))) errs.push(`row ${i}: date must be YYYY-MM-DD`);
  return errs;
}

/** The rows that can be played, in file order: malformed rows and repeats (same riddle, or a date already taken) are left out. */
export function usableRiddles(list) {
  if (!Array.isArray(list)) return { rows: [], errors: ["riddles.json must be an array"] };
  const rows = [], errors = [], keys = new Set(), dates = new Set();
  list.forEach((r, i) => {
    const errs = rowErrors(r, i);
    if (!errs.length && keys.has(riddleKey(r))) errs.push(`row ${i}: duplicate riddle ${riddleKey(r)}`);
    if (!errs.length && r.date && dates.has(r.date)) errs.push(`row ${i}: date ${r.date} is already taken by another riddle`);
    if (errs.length) { errors.push(...errs); return; }
    keys.add(riddleKey(r)); if (r.date) dates.add(r.date);
    rows.push(r);
  });
  return { rows, errors };
}

/** Problems in the bank, one message per problem naming the row index; [] when the file is good. */
export const validateRiddles = list => usableRiddles(list).errors;

/** Rows whose series is not on the site: a warning only (the riddle still plays, without a series button). */
export function unknownSeries(list, ids) {
  return (Array.isArray(list) ? list : []).flatMap((r, i) => (r && Number.isInteger(r.tmdbId) && !ids.has(r.tmdbId) ? [`row ${i}: tmdbId ${r.tmdbId} is not a series on the site`] : []));
}

function usedKeys(dir, log) {
  const used = new Set();
  for (const name of fs.readdirSync(dir)) {
    if (!FILE_RE.test(name)) continue;
    try { for (const k of JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")).used?.riddles ?? []) used.add(k); }
    catch (e) { log.warn(`make-games: skipping unreadable ${name} (${e.message})`); }
  }
  return used;
}

const readDay = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
const writeDay = (file, d) => fs.writeFileSync(file, JSON.stringify(d) + "\n");

/**
 * Writes a riddle into each existing day file from today to today+days-1 that has none: the riddle dated
 * for that day, else the next undated one in file order. Day files are pruned after 90 days, so "used" is
 * also a position: undated riddles up to the last one still on record count as played (new riddles go at
 * the end of the file). A dated riddle takes over its day from a queued riddle if that day is still in the
 * future; the queued riddle goes back to the queue. Today's riddle is never changed.
 */
export function assignRiddles({ riddles, dir, today, days = 8, log = console }) {
  const used = usedKeys(dir, log), assigned = {}, empty = [], back = new Set();
  const undated = riddles.filter(r => !r.date), datedKeys = new Set(riddles.filter(r => r.date).map(riddleKey));
  // 1. A dated riddle takes its future day back from a queued one.
  for (const r of riddles) {
    if (!r.date || r.date <= today || r.date >= addDays(today, days) || used.has(riddleKey(r))) continue;
    const file = path.join(dir, r.date + ".json"), d = readDay(file);
    const cur = d?.games?.riddle && riddleKey(d.games.riddle);
    if (!cur || datedKeys.has(cur)) continue;
    const { riddle, ...games } = d.games;
    writeDay(file, { ...d, games, used: { ...d.used, riddles: (d.used?.riddles ?? []).filter(k => k !== cur) } });
    used.delete(cur); back.add(cur);
  }
  // 2. Fill every day without a riddle.
  let mark = -1;
  undated.forEach((r, i) => { if (used.has(riddleKey(r))) mark = i; });
  const free = r => !used.has(riddleKey(r)) && (r.date ? r.date >= today : back.has(riddleKey(r)) || undated.indexOf(r) > mark);
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i), file = path.join(dir, date + ".json"), d = readDay(file);
    if (!d || d.games?.riddle) continue;
    const r = riddles.find(x => x.date === date && free(x)) ?? riddles.find(x => !x.date && free(x));
    if (!r) { empty.push(date); log.warn(`make-games: no riddle for ${date}`); continue; }
    const key = riddleKey(r);
    writeDay(file, { ...d, games: { ...d.games, riddle: toPuzzle(r) }, used: { ...d.used, riddles: [...(d.used?.riddles ?? []), key] } });
    used.add(key); back.delete(key);
    assigned[date] = key;
  }
  return { assigned, empty };
}
