// Nightly: mcu.json (story order, by hand) + TMDB → site/mcu-data.json. Best effort: never stops the series update.
// Flags: --dry (print, write nothing)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmdbGet, pool } from "./lib/api.mjs";
import { loadEnv } from "./lib/env.mjs";
import { validateMcu, movieLive, seasonLive } from "./lib/mcu.mjs";
import { videoVerdicts } from "./lib/youtube.mjs";

const CONCURRENCY = 4;
const MAX_FAILED = 0.2; // more than this share failing → keep yesterday's file
const EXTRA = { append_to_response: "watch/providers,videos", include_video_language: "en,he,null" };
const readJson = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

async function fetchLive(row, fetchImpl, map) {
  if (row.kind === "movie") {
    const m = await tmdbGet(`/movie/${row.tmdb}`, { language: "en-US", ...EXTRA }, fetchImpl);
    const he = await tmdbGet(`/movie/${row.tmdb}`, { language: "he-IL" }, fetchImpl).catch(() => null);
    return movieLive(m, he, map);
  }
  const tv = await tmdbGet(`/tv/${row.tmdb}`, { language: "en-US", ...EXTRA }, fetchImpl);
  const he = await tmdbGet(`/tv/${row.tmdb}`, { language: "he-IL" }, fetchImpl).catch(() => null);
  const s = await tmdbGet(`/tv/${row.tmdb}/season/${row.season}`, { language: "en-US", append_to_response: "videos", include_video_language: "en,he,null" }, fetchImpl);
  return seasonLive(tv, he, s, map);
}

export async function run({ items, prev, fetchImpl = fetch, now, youtubeKey = null, map = readJson("./providers.json") }) {
  const warnings = [];
  const errs = validateMcu(items);
  const bad = new Set(errs.map(e => Number(/^row (\d+):/.exec(e)?.[1])).filter(Number.isInteger));
  errs.forEach(e => warnings.push(`mcu.json ${e}`));
  const rows = items.map((r, i) => ({ r, i })).filter(({ i }) => !bad.has(i));
  const prevById = new Map((prev?.items ?? []).map(x => [x.id, x]));

  let failed = 0;
  const got = await pool(rows, CONCURRENCY, async ({ r, i }) => {
    try { return { r, i, live: await fetchLive(r, fetchImpl, map) }; }
    catch (err) { failed++; warnings.push(`${r.id}: ${err.message}`); return { r, i, live: null }; }
  });
  const abort = rows.length > 0 && failed / rows.length > MAX_FAILED;

  // Trailers: the first candidate that plays in Israel (only with a YouTube key; otherwise TMDB's first pick).
  let ok = null;
  if (youtubeKey) {
    try { const v = await videoVerdicts(got.flatMap(g => g.live?.cands ?? []), { key: youtubeKey, region: "IL", fetchImpl }); ok = k => v.get(k) === true; }
    catch (err) { warnings.push(`YouTube check failed, keeping TMDB's first trailers: ${err.message}`); }
  }

  const out = [];
  for (const { r, i, live } of got) {
    if (live) {
      const { cands, ...fields } = live;
      out.push({ ...r, story_i: i, ...fields, trailer: (ok ? cands.find(ok) : cands[0]) ?? null, fetchedAt: now });
    } else {
      const old = prevById.get(r.id);
      if (old) out.push({ ...old, ...r, story_i: i }); // yesterday's details, today's place on the timeline
    }
  }
  return { data: { updatedAt: now, items: out }, warnings, abort, failed };
}

async function main() {
  loadEnv();
  if (!process.env.TMDB_TOKEN) { console.error("TMDB_TOKEN must be set"); process.exit(1); }
  const dry = process.argv.includes("--dry");
  const items = JSON.parse(readFileSync("mcu.json", "utf8"));
  const file = "site/mcu-data.json";
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const r = await run({ items, prev, now: new Date().toISOString(), youtubeKey: process.env.YOUTUBE_KEY || null });
  for (const w of r.warnings) console.warn(`warn: ${w}`);
  console.log(`${r.data.items.length} items, ${r.failed} failed`);
  if (r.abort) { console.error(`too many failures (${r.failed}): keeping ${file}`); process.exit(1); }
  if (!dry) writeFileSync(file, JSON.stringify(r.data) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
