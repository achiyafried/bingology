// Nightly: series.json + TMDB + OMDb → site/data.json
// Flags: --only N (smoke test, writes nothing, skips the pool)  --offline (no network, prev/fallback only)
//        --keep-pool (refresh curated series only; keep last night's pool — used when adding a series)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmdbGet, omdbRating, pool } from "./lib/api.mjs";
import { loadEnv } from "./lib/env.mjs";
import { transformTv } from "./lib/tmdb.mjs";
import { mergeEntry, validateData, shouldAbort, sameData, finishText } from "./lib/merge.mjs";
import { writeNews } from "./lib/news.mjs";
import { discoverParams, rankPool, poolEntry, poolSizeFor, TIERS } from "./lib/discover.mjs";

const CONCURRENCY = 8;
const APPEND = "aggregate_credits,watch/providers,external_ids,content_ratings";
const readJson = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

const MAX_DISCOVER_PAGES = 80;
const OMDB_BUDGET = 900; // OMDb free tier: 1000 requests a day; leave room for manual runs and adds
const POOL_CAST = 8;
const POOL_MIN_IMDB = 7.5; // pool series rated lower on IMDb are left out (unknown is kept)

const IMDB_MAX_AGE_MS = 3 * 24 * 3600 * 1000; // IMDb ratings move slowly: refresh each series every 3 days

/** TMDB details (en-US, with extras) + Hebrew overview + IMDb rating (cached, budgeted) for one id. */
async function fetchLive(id, fetchImpl, map, warnings, old, ctx) {
  // Decide on OMDb before any await, so the budget is spent in list order (curated first, then pool by rank).
  const fresh = !!old?.imdbAt && Date.parse(ctx.now) - Date.parse(old.imdbAt) < IMDB_MAX_AGE_MS;
  const useOmdb = !fresh && ctx.budget > 0 && (ctx.budget--, true);
  // English for consistent names; a light Hebrew request only for the Hebrew description.
  const tv = await tmdbGet(`/tv/${id}`, { language: "en-US", append_to_response: APPEND }, fetchImpl);
  const he = await tmdbGet(`/tv/${id}`, { language: "he-IL" }, fetchImpl).catch(() => null);
  const { live, warnings: w } = transformTv(tv, { map, he });
  w.forEach(x => warnings.add(x));
  if (fresh) return { tv, live, imdb: old.imdb ?? null, imdbAt: old.imdbAt };
  const r = useOmdb ? await omdbRating(live.imdbId, fetchImpl) : undefined;
  if (r === undefined) return { tv, live, imdb: null, imdbAt: old?.imdbAt ?? null }; // keep the old score, retry later
  return { tv, live, imdb: r, imdbAt: ctx.now };
}

/** Candidate ids for the wide pool, best first. Throws if discovery itself fails. */
async function discoverPool(curatedIds, size, fetchImpl) {
  const results = [];
  let ranked = [];
  for (const tier of TIERS) {
    for (let page = 1; page <= MAX_DISCOVER_PAGES; page++) {
      const r = await tmdbGet("/discover/tv", discoverParams(page, tier), fetchImpl);
      results.push(...(r.results || []));
      if (page >= (r.total_pages || 0)) break;
    }
    ranked = rankPool(results, curatedIds, size);
    if (ranked.length >= size) break;
  }
  return ranked;
}

export async function run({ series, prev, fetchImpl = fetch, now, only, offline = false, map = readJson("./providers.json"), poolSize = 0, keepPool = false, omdbBudget = Infinity, blurbs = readJson("./pool-blurbs.json") }) {
  const ctx = { now, budget: omdbBudget };
  const list = only ? series.slice(0, only) : series;
  const prevById = new Map((prev?.series ?? []).map(s => [s.tmdbId, s]));
  const warnings = new Set();

  // 1. Curated series: strict (failures count toward aborting the run).
  const results = await pool(list, CONCURRENCY, async entry => {
    const old = prevById.get(entry.tmdbId) ?? null;
    const keep = s => Object.assign(s, { imdbAt: old?.imdbAt ?? null });
    if (offline) return { s: keep(mergeEntry(entry, null, null, old, now)) };
    try {
      const { live, imdb, imdbAt } = await fetchLive(entry.tmdbId, fetchImpl, map, warnings, old, ctx);
      return { s: Object.assign(mergeEntry(entry, live, imdb, old, now), { imdbAt }) };
    } catch (err) {
      return { s: keep(mergeEntry(entry, null, null, old, now)), err };
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
          const { tv, live, imdb, imdbAt } = await fetchLive(id, fetchImpl, map, warnings, old, ctx);
          const s = mergeEntry(poolEntry(tv, live.minAge), live, imdb, old?.lists?.includes("pool") ? old : null, now);
          s.imdbAt = imdbAt;
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

  const data = { updatedAt: now, series: curated.concat(poolSeries).map(s => finishText(s, blurbs)) };
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

  const now = new Date().toISOString(); // one stamp: news diffs rows whose fetchedAt === this exact value
  const r = await run({ series, prev, now, only, offline, poolSize: poolSizeFor(series.length), keepPool, omdbBudget: OMDB_BUDGET });
  r.warnings.forEach(w => console.warn("warn:", w));
  r.errors.forEach(e => console.error("invalid:", e));
  console.log(`${r.data.series.length} series, ${r.failed.length} failed${r.unreachable ? ", TMDB unreachable" : ""}`);

  if (r.abort) { console.error("aborting: data.json left unchanged"); process.exit(1); }
  if (only) { console.log("smoke test passed (nothing written)"); return; }
  // News is decided independently of whether data.json changed; failures only warn.
  writeNews({ prevData: prev, data: r.data, newsPath: "site/news.json", now,
    read: p => (existsSync(p) ? readFileSync(p, "utf8") : null), write: writeFileSync, warn: m => console.warn("warn:", m) });
  if (sameData(r.data, prev)) { console.log("no changes"); return; }
  writeFileSync(out, JSON.stringify(r.data) + "\n"); // compact: this file is downloaded by every visitor
  console.log(`wrote ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
