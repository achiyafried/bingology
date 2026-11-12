// Nightly: site/data.json → site/games/YYYY-MM-DD.json (today … today+7), then riddles.json → the riddle of each day.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeDays } from "./lib/games/make.mjs";
import { assignRiddles, validateRiddles } from "./lib/games/riddles.mjs";
import { israelToday } from "../site/lib/games/day.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const { series } = JSON.parse(fs.readFileSync(root + "site/data.json", "utf8"));
const today = israelToday(new Date()), dir = root + "site/games";
const { created, deleted, missing } = makeDays({ series, dir, today });
console.log(`make-games: created ${created.length}, deleted ${deleted.length}`);
for (const [date, ids] of Object.entries(missing)) console.warn(`make-games: ${date} missing ${ids.join(", ")}`);

// Riddles are best effort: a missing or broken bank never stops the other games.
let riddles = null;
try {
  riddles = JSON.parse(fs.readFileSync(root + "riddles.json", "utf8"));
  const errs = validateRiddles(riddles, new Set(series.map(s => s.tmdbId)));
  if (errs.length) { console.warn(`make-games: riddles skipped: ${errs.join("; ")}`); riddles = null; }
} catch (e) {
  console.warn(`make-games: riddles skipped: ${e.message}`);
}
if (riddles) {
  const { assigned } = assignRiddles({ riddles, dir, today });
  console.log(`make-games: riddles assigned ${Object.keys(assigned).length}`);
}
