// Nightly: site/data.json → site/games/YYYY-MM-DD.json (today … today+7)
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeDays } from "./lib/games/make.mjs";
import { israelToday } from "../site/lib/games/day.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const { series } = JSON.parse(fs.readFileSync(root + "site/data.json", "utf8"));
const { created, deleted, missing } = makeDays({
  series, dir: root + "site/games", today: israelToday(new Date()),
});
console.log(`make-games: created ${created.length}, deleted ${deleted.length}`);
for (const [date, ids] of Object.entries(missing)) console.warn(`make-games: ${date} missing ${ids.join(", ")}`);
