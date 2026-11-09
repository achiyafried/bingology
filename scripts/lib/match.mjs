const yearOf = r => (r.first_air_date ? Number(r.first_air_date.slice(0, 4)) : null);
const norm = s => (s || "").trim().toLowerCase();
const cand = r => ({ id: r.id, name: r.name, year: yearOf(r) });

/** Pick the TMDB search result for a series, or return candidates for manual review. */
export function pickMatch(results, want) {
  // 1. Exact name within ±1 year (premiere dates drift between sources).
  const exact = results.filter(r => (norm(r.name) === norm(want.name) || norm(r.original_name) === norm(want.name)) && Math.abs(yearOf(r) - want.year) <= 1);
  if (exact.length === 1) return { id: exact[0].id };
  if (exact.length > 1) return { candidates: exact.map(cand) };
  // 2. Any single result in the wanted year (e.g. Hebrew titles that differ in English).
  const sameYear = results.filter(r => yearOf(r) === want.year);
  if (sameYear.length === 1) return { id: sameYear[0].id };
  if (sameYear.length > 1) return { candidates: sameYear.map(cand) };
  return { candidates: results.slice(0, 5).map(cand) };
}
