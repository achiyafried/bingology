// Nightly: kids.json (by hand) + TMDB → site/kids-data.json. Best effort: never stops the series update.
// Flags: --dry (print, write nothing)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmdbGet, pool } from "./lib/api.mjs";
import { loadEnv } from "./lib/env.mjs";
import { validateKids, kidsLive, overCap } from "./lib/kids.mjs";

const CONCURRENCY = 4;
const MAX_FAILED = 0.2; // more than this share failing → keep yesterday's file

async function fetchLive(row, fetchImpl, map) {
  const tv = await tmdbGet(`/tv/${row.tmdb}`, { language: "en-US", append_to_response: "watch/providers,content_ratings" }, fetchImpl);
  const he = await tmdbGet(`/tv/${row.tmdb}`, { language: "he-IL" }, fetchImpl).catch(() => null);
  return kidsLive(tv, he, map);
}

export async function run({ rows, prev, fetchImpl = fetch, now, map }) {
  const warnings = [];
  const errs = validateKids(rows);
  const bad = new Set(errs.map(e => Number(/^row (\d+):/.exec(e)?.[1])).filter(Number.isInteger));
  errs.forEach(e => warnings.push(`kids.json ${e}`));
  const good = Array.isArray(rows) ? rows.filter((_, i) => !bad.has(i)) : [];
  const prevById = new Map((prev?.items ?? []).map(x => [x.tmdb, x]));

  let failed = 0;
  const got = await pool(good, CONCURRENCY, async r => {
    try { return { r, live: await fetchLive(r, fetchImpl, map) }; }
    catch (err) { failed++; warnings.push(`${r.tmdb}: ${err.message}`); return { r, live: null }; }
  });
  const abort = good.length > 0 && failed / good.length > MAX_FAILED;

  const items = [];
  for (const { r, live } of got) {
    let item;
    if (live) item = { tmdb: r.tmdb, age: r.age, ...live, nameHe: r.he ?? live.nameHe, fetchedAt: now };
    else if (prevById.has(r.tmdb)) item = { ...prevById.get(r.tmdb), age: r.age, ...(r.he ? { nameHe: r.he } : {}) };
    else continue;
    if (overCap(item)) { warnings.push(`${r.tmdb}: minAge ${item.minAge} is above the ${r.age} cap`); continue; }
    items.push(item);
  }
  return { data: { updatedAt: now, items }, warnings, abort, failed };
}

async function main() {
  loadEnv();
  if (!process.env.TMDB_TOKEN) { console.error("TMDB_TOKEN must be set"); process.exit(1); }
  const dry = process.argv.includes("--dry");
  const rows = JSON.parse(readFileSync("kids.json", "utf8"));
  const file = "site/kids-data.json";
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const map = JSON.parse(readFileSync("scripts/providers.json", "utf8"));
  const r = await run({ rows, prev, now: new Date().toISOString(), map });
  for (const w of r.warnings) console.warn(`warn: ${w}`);
  console.log(`${r.data.items.length} series, ${r.failed} failed`);
  if (r.abort) { console.error(`too many failures (${r.failed}): keeping ${file}`); process.exit(1); }
  if (!dry) writeFileSync(file, JSON.stringify(r.data) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
