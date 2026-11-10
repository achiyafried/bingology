// Nightly: series.json + TMDB + OMDb → site/data.json
// Flags: --only N (smoke test, writes nothing)  --offline (no network, prev/fallback only)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmdbGet, omdbRating, pool } from "./lib/api.mjs";
import { loadEnv } from "./lib/env.mjs";
import { transformTv } from "./lib/tmdb.mjs";
import { mergeEntry, validateData, shouldAbort, sameData } from "./lib/merge.mjs";

const CONCURRENCY = 8;
const APPEND = "aggregate_credits,watch/providers,external_ids";
const readJson = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

export async function run({ series, prev, fetchImpl = fetch, now, only, offline = false, map = readJson("./providers.json") }) {
  const list = only ? series.slice(0, only) : series;
  const prevById = new Map((prev?.series ?? []).map(s => [s.tmdbId, s]));
  const warnings = new Set();

  const results = await pool(list, CONCURRENCY, async entry => {
    const old = prevById.get(entry.tmdbId) ?? null;
    if (offline) return { s: mergeEntry(entry, null, null, old, now) };
    try {
      // English for consistent names; a light Hebrew request only for the Hebrew description.
      const tv = await tmdbGet(`/tv/${entry.tmdbId}`, { language: "en-US", append_to_response: APPEND }, fetchImpl);
      const he = await tmdbGet(`/tv/${entry.tmdbId}`, { language: "he-IL" }, fetchImpl).catch(() => null);
      const { live, warnings: w } = transformTv(tv, { map, he });
      w.forEach(x => warnings.add(x));
      const imdb = await omdbRating(live.imdbId, fetchImpl);
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

  const data = { updatedAt: now, series: results.map(r => r.s) };
  const errors = validateData(data, list.length);
  const abort = !offline && (unreachable || shouldAbort(failed.length, list.length)) || errors.length > 0;
  return { data, failed, warnings: [...warnings], errors, abort, unreachable };
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const offline = args.includes("--offline");
  const oi = args.indexOf("--only");
  const only = oi >= 0 ? Number(args[oi + 1]) : undefined;
  if (!offline && (!process.env.TMDB_TOKEN || !process.env.OMDB_KEY)) {
    console.error("TMDB_TOKEN and OMDB_KEY must be set (or use --offline)");
    process.exit(1);
  }
  const series = JSON.parse(readFileSync("series.json", "utf8"));
  const out = "site/data.json";
  const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;

  const r = await run({ series, prev, now: new Date().toISOString(), only, offline });
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
