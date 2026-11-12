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

/** Problems in the bank, one message per problem naming the row index; [] when the file is good. */
export function validateRiddles(list, ids) {
  if (!Array.isArray(list)) return ["riddles.json must be an array"];
  const errs = [], keys = new Set(), dates = new Set();
  list.forEach((r, i) => {
    if (!r || typeof r !== "object") { errs.push(`row ${i}: not an object`); return; }
    if (typeof r.clue !== "string" || !r.clue.trim()) errs.push(`row ${i}: clue is missing`);
    if (typeof r.answer !== "string" || !ANSWER_RE.test(r.answer)) errs.push(`row ${i}: answer must be Hebrew letters with single spaces between words`);
    if (!Number.isInteger(r.tmdbId) || !ids.has(r.tmdbId)) errs.push(`row ${i}: tmdbId ${r.tmdbId} is not a series on the site`);
    if (r.explain !== undefined && typeof r.explain !== "string") errs.push(`row ${i}: explain must be text`);
    if (r.date !== undefined) {
      if (typeof r.date !== "string" || !validDate(r.date)) errs.push(`row ${i}: date must be YYYY-MM-DD`);
      else if (dates.has(r.date)) errs.push(`row ${i}: date ${r.date} is already taken by another riddle`);
      else dates.add(r.date);
    }
    const k = riddleKey(r);
    if (keys.has(k)) errs.push(`row ${i}: duplicate riddle ${k}`);
    keys.add(k);
  });
  return errs;
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

/**
 * Writes a riddle into each existing day file from today to today+days-1 that has none: the riddle dated
 * for that day, else the first undated one never used. A day that already has a riddle is not touched.
 */
export function assignRiddles({ riddles, dir, today, days = 8, log = console }) {
  const used = usedKeys(dir, log), assigned = {}, empty = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i), file = path.join(dir, date + ".json");
    if (!fs.existsSync(file)) continue;
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    if (d.games?.riddle) continue;
    const free = r => !used.has(riddleKey(r));
    const r = riddles.find(x => x.date === date && free(x)) ?? riddles.find(x => !x.date && free(x));
    if (!r) { empty.push(date); log.warn(`make-games: no riddle for ${date}`); continue; }
    const key = riddleKey(r);
    d.games = { ...d.games, riddle: toPuzzle(r) };
    d.used = { ...d.used, riddles: [...(d.used?.riddles ?? []), key] };
    fs.writeFileSync(file, JSON.stringify(d) + "\n");
    used.add(key);
    assigned[date] = key;
  }
  return { assigned, empty };
}
