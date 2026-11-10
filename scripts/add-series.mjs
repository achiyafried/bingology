// Called by .github/workflows/add-series.yml with the issue event. Adds one series to series.json
// and writes add-result.json ({ status, message, id?, name? }) for the workflow to comment with.
// Usage: node scripts/add-series.mjs [event.json]   (defaults to $GITHUB_EVENT_PATH)
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/env.mjs";
import { tmdbGet } from "./lib/api.mjs";
import { minAgeOf } from "./lib/tmdb.mjs";
import { parseIssueForm, tmdbIdFrom, buildEntry, chooseMatch } from "./lib/add-series.mjs";

loadEnv();
const done = r => { writeFileSync("add-result.json", JSON.stringify(r, null, 2)); console.log(JSON.stringify(r)); process.exit(0); };
const link = id => `https://www.themoviedb.org/tv/${id}`;

const event = JSON.parse(readFileSync(process.argv[2] || process.env.GITHUB_EVENT_PATH, "utf8"));
const form = parseIssueForm(event.issue?.body);
if (!form.name && !form.tmdb) done({ status: "invalid", message: "לא מצאתי שם סדרה או קישור בטופס." });

let id = tmdbIdFrom(form.tmdb);
if (form.tmdb && !id) done({ status: "invalid", message: "הקישור לא נראה כמו קישור לסדרה ב-TMDB. הוא צריך להיראות כך: https://www.themoviedb.org/tv/12345" });
if (!id) {
  const res = (await tmdbGet("/search/tv", { query: form.name, language: "en-US" })).results || [];
  const m = chooseMatch(res, form.name);
  if (m.id) id = m.id;
  else if (!m.candidates.length) done({ status: "notfound", message: `לא מצאתי ב-TMDB סדרה בשם "${form.name}". אפשר לחפש בעצמכם ב-themoviedb.org ולהדביק את הקישור בטופס (עריכת הבקשה תפעיל את התהליך שוב).` });
  else done({ status: "ambiguous", message: "מצאתי כמה סדרות מתאימות. ערכו את הבקשה והדביקו את הקישור הנכון בשדה של TMDB:\n\n" + m.candidates.map(c => `- ${c.name} (${c.year}): ${link(c.id)}`).join("\n") });
}

const series = JSON.parse(readFileSync("series.json", "utf8"));
const existing = series.find(s => s.tmdbId === id);
if (existing?.lists.includes("mine")) done({ status: "exists", id, name: existing.name, message: `"${existing.name}" כבר ברשימה האישית.` });

const tv = await tmdbGet(`/tv/${id}`, { language: "en-US", append_to_response: "content_ratings" });
if (existing) {
  existing.lists = ["mine", ...existing.lists.filter(l => l !== "mine")];
  if (form.blurb) existing.blurb = form.blurb;
} else {
  series.push(buildEntry(tv, minAgeOf(tv), form));
}
writeFileSync("series.json", JSON.stringify(series, null, 2) + "\n");
done({ status: "added", id, name: tv.name, message: `"${tv.name}" נוספה לרשימה האישית ✓ (${link(id)}). האתר יתעדכן בעוד כמה דקות.` });
