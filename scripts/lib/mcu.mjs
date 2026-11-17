// The MCU timeline: mcu.json (hand-written, story order) → site/mcu-data.json (nightly, with TMDB details).

const KINDS = new Set(["movie", "season"]);
const text = v => typeof v === "string" && v.trim() !== "";

/** The id an item must have: movie:<tmdb> or tv:<tmdb>:s<season>. Seen marks are stored by it. */
export const mcuId = r => (r.kind === "season" ? `tv:${r.tmdb}:s${r.season}` : `movie:${r.tmdb}`);

/** Problems in mcu.json, one per problem naming the row; [] when it is good. */
export function validateMcu(list) {
  if (!Array.isArray(list)) return ["mcu.json must be an array"];
  const errs = [], ids = new Set();
  list.forEach((r, i) => {
    const e = m => errs.push(`row ${i}: ${m}`);
    if (!r || typeof r !== "object") return e("not an object");
    if (!KINDS.has(r.kind)) return e(`kind must be movie or season, not ${JSON.stringify(r.kind)}`);
    if (!Number.isInteger(r.tmdb) || r.tmdb <= 0) return e("tmdb must be a TMDB id number");
    if (r.kind === "season" && (!Number.isInteger(r.season) || r.season < 1)) return e("season must be a number from 1");
    if (r.id !== mcuId(r)) e(`id must be ${mcuId(r)}`);
    else if (ids.has(r.id)) e(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (!text(r.era)) e("era is missing");
    if (!text(r.story)) e("story is missing");
    if (!Number.isInteger(r.phase) || r.phase < 1 || r.phase > 6) e("phase must be 1–6");
    if (r.note !== undefined && !text(r.note)) e("note must be text");
  });
  return errs;
}
