import { readFileSync, writeFileSync } from "node:fs";
import { parseLegacy } from "./lib/legacy.mjs";

const d = parseLegacy(readFileSync("legacy/bingology-artifact.html", "utf8"));
writeFileSync("scripts/legacy-data.json", JSON.stringify(d, null, 2) + "\n");
console.log(`extracted ${d.RAW.length} series`);
