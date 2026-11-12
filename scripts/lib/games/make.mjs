// Nightly daily-games writer: one site/games/YYYY-MM-DD.json per day.
import fs from "node:fs";
import path from "node:path";
import { GAMES, addDays, israelToday } from "../../../site/lib/games/day.js";
import { makeRng } from "./rng.mjs";
import { buildPool, emptyRecent, KNOWN } from "./pool.mjs";
import * as guess from "./guess.mjs";
import * as odd from "./odd.mjs";
import * as chain from "./chain.mjs";
import * as groups from "./groups.mjs";
import * as blur from "./blur.mjs";

const GENERATORS = { guess, odd, chain, groups, blur };
const ATTEMPTS = 50;
// No-repeat windows in days. `actors` (blur) keeps the full recentDays window;
// odd keeps its own actor list so its fast rotation doesn't starve blur.
export const ODD_RECENT_DAYS = 14;
export const GROUPS_RECENT_DAYS = 4;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;
const KEYS = ["series", "actors", "pairs", "oddActors", "groups"];
const WINDOWS = { oddActors: ODD_RECENT_DAYS, groups: GROUPS_RECENT_DAYS };

export function buildDay(pool, date, recent, log = console, gens = GENERATORS) {
  const games = {};
  const used = Object.fromEntries(KEYS.map((k) => [k, []]));
  for (const { id } of GAMES) {
    // odd (earlier in GAMES) shows its actors by name and photo: blur must not pick one the same day.
    const r = id === "blur" ? { ...recent, actors: new Set([...recent.actors, ...used.oddActors]) } : recent;
    let result = null, lastError = null;
    for (let attempt = 0; attempt < ATTEMPTS && !result; attempt++) {
      try {
        result = gens[id].make(pool, makeRng(`${date}:${id}:${attempt}`), r) ?? null;
      } catch (e) {
        result = null;
        lastError = e;
      }
    }
    if (!result) {
      log.warn(`make-games: ${date}: no ${id} puzzle after ${ATTEMPTS} attempts, shipping without it${lastError ? ` (last error: ${lastError.message})` : ""}`);
      continue;
    }
    games[id] = result.puzzle;
    for (const k of KEYS) for (const v of result.used?.[k] ?? []) if (!used[k].includes(v)) used[k].push(v);
  }
  return { date, v: 1, used, games };
}

function recentFor(dir, date, recentDays, log) {
  const recent = emptyRecent();
  for (let i = 1; i <= recentDays; i++) {
    const d = addDays(date, -i);
    const file = path.join(dir, d + ".json");
    if (!fs.existsSync(file)) continue;
    try {
      const used = JSON.parse(fs.readFileSync(file, "utf8")).used ?? {};
      for (const k of KEYS) {
        if (i > (WINDOWS[k] ?? recentDays)) continue;
        for (const v of used[k] ?? []) recent[k].add(v);
      }
    } catch (e) {
      log.warn(`make-games: skipping unreadable ${d}.json (${e.message})`);
    }
  }
  return recent;
}

export function makeDays({
  series, dir, today = israelToday(new Date()), days = 8, keepDays = 90, recentDays = 60,
  log = console, known = KNOWN, gens = GENERATORS,
}) {
  fs.mkdirSync(dir, { recursive: true });
  const pool = buildPool(series, { known });
  const created = [], deleted = [], missing = {};
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const file = path.join(dir, date + ".json");
    if (fs.existsSync(file)) continue;
    const recent = recentFor(dir, date, recentDays, log);
    const day = buildDay(pool, date, recent, log, gens);
    fs.writeFileSync(file, JSON.stringify(day) + "\n");
    created.push(date);
    const gone = GAMES.map((g) => g.id).filter((id) => !(id in day.games));
    if (gone.length) missing[date] = gone;
  }
  const cutoff = addDays(today, -keepDays);
  for (const name of fs.readdirSync(dir)) {
    const m = FILE_RE.exec(name);
    if (m && m[1] < cutoff) {
      fs.unlinkSync(path.join(dir, name));
      deleted.push(name);
    }
  }
  return { created, deleted, missing };
}
