// Cache-busting for the deployed site: copy <src> to <out> and append ?v=<version> to every
// relative module specifier in .js files and to local script/stylesheet URLs in .html files.
// GitHub Pages serves everything with max-age=600, so without this a visitor can get a new
// app.js with an old cached module and a "does not provide an export named …" blank page.
// Data files (*.json) are copied as-is. Local dev serves site/ directly and never sees a stamp.
// Usage: node scripts/stamp.mjs <src> <out> <version>
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// from "./x.js" · import "./x.js" · import("./x.js") — single or double quotes, ./ or ../ paths.
const JS_SPEC = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.\.?\/[^"'?#\s]+\.js)\2/g;
// Any quoted relative .js path left without a query string (including template literals).
const LEFTOVER = /(["'`])(\.\.?\/[^"'`?#\s]*\.js)\1/g;
// src="app.js" / href="styles.css" — not absolute URLs or protocol-relative ones.
const HTML_REF = /\b(src|href)="(?![a-z][a-z0-9+.-]*:|\/\/)([^"?#]+\.(?:js|css))"/gi;

export const stampJs = (code, v) => code.replace(JS_SPEC, (_, pre, q, p) => `${pre}${q}${p}?v=${v}${q}`);
export const stampHtml = (html, v) => html.replace(HTML_REF, (_, attr, p) => `${attr}="${p}?v=${v}"`);
export const unstamped = code => [...code.matchAll(LEFTOVER)].map(m => m[2]);

const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export function stampSite(src, out, v) {
  if (!/^[\w.-]+$/.test(v || "")) throw new Error(`stamp: bad version ${JSON.stringify(v)}`);
  rmSync(out, { recursive: true, force: true });
  cpSync(src, out, { recursive: true });
  const missed = [];
  for (const p of walk(out)) {
    if (p.endsWith(".js")) {
      const code = stampJs(readFileSync(p, "utf8"), v);
      for (const s of unstamped(code)) missed.push(`${relative(out, p)}: ${s}`);
      writeFileSync(p, code);
    } else if (p.endsWith(".html")) {
      writeFileSync(p, stampHtml(readFileSync(p, "utf8"), v));
    }
  }
  if (missed.length) throw new Error(`stamp: relative imports left unversioned:\n${missed.join("\n")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [src, out, v] = process.argv.slice(2);
  if (!src || !out) { console.error("usage: node scripts/stamp.mjs <src> <out> <version>"); process.exit(2); }
  stampSite(src, out, v);
  console.log(`stamped ${src} -> ${out} with v=${v}`);
}
