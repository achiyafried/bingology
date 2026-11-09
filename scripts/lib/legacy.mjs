import vm from "node:vm";

const TABLES = ["RAW", "META", "NYTR", "MORE", "PRAISE"];

/** Index just past the bracket that closes the first [ or { at/after `from`, skipping string literals. */
function matchClose(src, from) {
  let depth = 0, quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { if (--depth === 0) return i + 1; }
  }
  throw new Error("legacy: unbalanced brackets");
}

/** Pull one `const NAME = …;` statement out of the legacy script and evaluate only that. */
function evalConst(script, name) {
  const start = script.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`legacy: ${name} not found`);
  const end = matchClose(script, script.indexOf("=", start) + 1);
  const code = script.slice(start, end).replace(`const ${name} =`, `globalThis.${name} =`);
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return JSON.parse(JSON.stringify(ctx[name]));
}

export function parseLegacy(html) {
  const s = html.indexOf("<script>");
  const e = html.lastIndexOf("</script>");
  if (s < 0 || e < 0) throw new Error("legacy: <script> not found");
  const script = html.slice(s + 8, e);
  return Object.fromEntries(TABLES.map(t => [t, evalConst(script, t)]));
}
