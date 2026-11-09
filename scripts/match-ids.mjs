// One-time: find the TMDB id for every series in series.json (or the legacy data on first run).
// Needs TMDB_TOKEN. Re-running only touches entries whose tmdbId is still null.
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { parseLegacy, legacyToSeries } from "./lib/legacy.mjs";
import { pickMatch } from "./lib/match.mjs";
import { tmdbGet } from "./lib/api.mjs";

if (!process.env.TMDB_TOKEN) { console.error("TMDB_TOKEN is not set"); process.exit(1); }

const entries = existsSync("series.json")
  ? JSON.parse(readFileSync("series.json", "utf8"))
  : legacyToSeries(parseLegacy(readFileSync("legacy/bingology-artifact.html", "utf8")));

const review = [];
for (const e of entries) {
  if (e.tmdbId != null) continue;
  const year = e.year ?? e.fallback.year;
  let res = (await tmdbGet("/search/tv", { query: e.name, first_air_date_year: year, language: "en-US" })).results;
  if (!res.length) res = (await tmdbGet("/search/tv", { query: e.name, language: "en-US" })).results;
  const m = pickMatch(res, { name: e.name, year });
  if (m.id) { e.tmdbId = m.id; console.log(`✓ ${e.name} → ${m.id}`); }
  else { review.push({ e, year, candidates: m.candidates }); console.log(`? ${e.name} (${m.candidates.length} candidates)`); }
}

// `year` is only needed for matching; the fallback keeps the legacy value.
const out = entries.map(({ year, ...rest }) => rest);
writeFileSync("series.json", JSON.stringify(out, null, 2) + "\n");

if (review.length) {
  const md = ["# Series that need a manual TMDB id", "", "Write the right id into `tmdbId` in series.json, then run `npm run match` again.", ""];
  for (const { e, year, candidates } of review) {
    md.push(`## ${e.name} (${year})`);
    if (!candidates.length) md.push("- no results — search https://www.themoviedb.org/search/tv");
    for (const c of candidates) md.push(`- ${c.id} · ${c.name} · ${c.year ?? "?"} · https://www.themoviedb.org/tv/${c.id}`);
    md.push("");
  }
  writeFileSync("needs-review.md", md.join("\n"));
  console.log(`\n${review.length} series need review → needs-review.md`);
} else {
  if (existsSync("needs-review.md")) rmSync("needs-review.md");
  console.log("\nall series matched");
}
