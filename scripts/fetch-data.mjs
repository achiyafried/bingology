// Nightly: series.json + TMDB + OMDb → site/data.json
// Flags: --only N (smoke test, writes nothing, skips the pool)  --offline (no network, prev/fallback only)
//        --keep-pool (refresh curated series only; keep last night's pool — used when adding a series)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmdbGet, omdbRating, pool } from "./lib/api.mjs";
import { loadEnv } from "./lib/env.mjs";
import { transformTv } from "./lib/tmdb.mjs";
import { mergeEntry, validateData, shouldAbort, sameData } from "./lib/merge.mjs";
import { discoverParams, rankPool, poolEntry, POOL_SIZE } from "./lib/discover.mjs";

const CONCURRENCY = 8;
const APPEND = "aggregate_credits,watch/providers,external_ids,content_ratings";
const readJson = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

const MAX_DISCOVER_PAGES = 40;
const POOL_CAST = 8;
const POOL_MIN_IMDB = 7.5; // pool series rated lower on IMDb are left out (unknown is kept)

/** TMDB details (en-US, with extras) + Hebrew overview + IMDb rating for one id. */
async function fetchLive(id, fetchImpl, map, warnings) {
  // English for consistent names; a light Hebrew request only for the Hebrew description.
  const tv = await tmdbGet(`/tv/${id}`, { language: "en-US", append_to_response: APPEND }, fetchImpl);
  const he = await tmdbGet(`/tv/${id}`, { language: "he-IL" }, fetchImpl).catch(() => null);
  const { live, warnings: w } = transformTv(tv, { map, he });
  w.forEach(x => warnings.add(x));
  const imdb = await omdbRating(live.imdbId, fetchImpl);
  return { tv, live, imdb };
}

/** Candidate ids for the wide pool, best first. Throws if discovery itself fails. */
async function discoverPool(curatedIds, size, fetchImpl) {
  const results = [];
  for (let page = 1; page <= MAX_DISCOVER_PAGES; page++) {
    const r = await tmdbGet("/discover/tv", discoverParams(page), fetchImpl);
    results.push(...(r.results || []));
    if (page >= (r.total_pages || 0) || results.length >= size * 1.6) break;
  }
  return rankPool(results, curatedIds, size);
}

export async function run({ series, prev, fetchImpl = fetch, now, only, offline = false, map = readJson("./providers.json"), poolSize = 0, keepPool = false }) {
  const list = only ? series.slice(0, only) : series;
  const prevById = new Map((prev?.series ?? []).map(s => [s.tmdbId, s]));
  const warnings = new Set();

  // 1. Curated series: strict (failures count toward aborting the run).
  const results = await pool(list, CONCURRENCY, async entry => {
    const old = prevById.get(entry.tmdbId) ?? null;
    if (offline) return { s: mergeEntry(entry, null, null, old, now) };
    try {
      const { live, imdb } = await fetchLive(entry.tmdbId, fetchImpl, map, warnings);
      return { s: mergeEntry(entry, live, imdb, old, now) };
    } catch (err) {
      return { s: mergeEntry(entry, null, null, old, now), err };
    }
  });

  const failedIdx = results.map((r, i) => (r.err ? i : -1)).filter(i => i >= 0);
  const failed = failedIdx.map(i => list[i].name);
  for (const i of failedIdx) warnings.add(`${list[i].name}: ${results[i].err.message}`);
  const head = results.slice(0, 3);
  const unreachable = !offline && head.length > 0 && head.every(r => r.err && r.err.status === undefined);
  const curated = results.map(r => r.s);
  const errors = validateData({ series: curated }, list.length);

  // 2. Wide pool: best effort (a failing pool series is skipped, never aborts the run).
  let poolSeries = [];
  if (poolSize && !only) {
    const curatedIds = new Set(list.map(e => e.tmdbId));
    const prevPool = (prev?.series ?? []).filter(s => s.lists?.includes("pool") && !curatedIds.has(s.tmdbId));
    let ids = null;
    if (!offline && !keepPool) {
      // Extra candidates so the pool stays full after the IMDb filter.
      try { ids = await discoverPool(curatedIds, Math.ceil(poolSize * 1.3), fetchImpl); }
      catch (err) { warnings.add(`discover failed, keeping last pool: ${err.message}`); }
    }
    if (!ids) poolSeries = prevPool;
    else {
      const fetched = await pool(ids, CONCURRENCY, async id => {
        const old = prevById.get(id) ?? null;
        try {
          const { tv, live, imdb } = await fetchLive(id, fetchImpl, map, warnings);
          const s = mergeEntry(poolEntry(tv, live.minAge), live, imdb, old?.lists?.includes("pool") ? old : null, now);
          s.cast = s.cast.slice(0, POOL_CAST);
          if (typeof s.imdb === "number" && s.imdb < POOL_MIN_IMDB) return { low: true };
          return s;
        } catch (err) {
          warnings.add(`pool ${id}: ${err.message}`);
          return old?.lists?.includes("pool") ? old : null;
        }
      });
      const low = fetched.filter(s => s?.low).length;
      if (low) warnings.add(`pool: left out ${low} series rated under ${POOL_MIN_IMDB} on IMDb`);
      const usable = fetched.filter(s => s && !s.low && validateData({ series: [s] }, 1).length === 0);
      const dropped = fetched.length - low - usable.length;
      poolSeries = usable.slice(0, poolSize);
      if (dropped) warnings.add(`pool: skipped ${dropped} series without usable data`);
    }
  }

  const data = { updatedAt: now, series: curated.concat(poolSeries) };
  const abort = !offline && (unreachable || shouldAbort(failed.length, list.length)) || errors.length > 0;
  return { data, failed, warnings: [...warnings], errors, abort, unreachable };
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const offline = args.includes("--offline");
  const oi = args.indexOf("--only");
  const only = oi >= 0 ? Number(args[oi + 1]) : undefined;
  const keepPool = args.includes("--keep-pool");
  if (!offline && (!process.env.TMDB_TOKEN || !process.env.OMDB_KEY)) {
    console.error("TMDB_TOKEN and OMDB_KEY must be set (or use --offline)");
    process.exit(1);
  }
  const series = JSON.parse(readFileSync("series.json", "utf8"));
  const out = "site/data.json";
  const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;

  const r = await run({ series, prev, now: new Date().toISOString(), only, offline, poolSize: POOL_SIZE, keepPool });
  r.warnings.forEach(w => console.warn("warn:", w));
  r.errors.forEach(e => console.error("invalid:", e));
  console.log(`${r.data.series.length} series, ${r.failed.length} failed${r.unreachable ? ", TMDB unreachable" : ""}`);

  if (r.abort) { console.error("aborting: data.json left unchanged"); process.exit(1); }
  if (only) { console.log("smoke test passed (nothing written)"); return; }
  if (sameData(r.data, prev)) { console.log("no changes"); return; }
  writeFileSync(out, JSON.stringify(r.data, null, 2) + "\n");
  console.log(`wrote ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
