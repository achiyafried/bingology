// Applies supabase/schema.sql to the TEST Supabase project only (via the Management API).
// Needs SUPABASE_TEST_URL and SUPABASE_ACCESS_TOKEN in .env. Never targets any other project.
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const url = process.env.SUPABASE_TEST_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("Missing SUPABASE_TEST_URL or SUPABASE_ACCESS_TOKEN in .env — refusing to run.");
  process.exit(1);
}
const m = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url);
if (!m) {
  console.error("SUPABASE_TEST_URL must look like https://<ref>.supabase.co — refusing to run.");
  process.exit(1);
}
const ref = m[1];
const file = process.argv[2] ?? "supabase/schema.sql";
const query = readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}): ${text}`);
  process.exit(1);
}
console.log(`Applied ${file} to test project (${res.status}).`);
