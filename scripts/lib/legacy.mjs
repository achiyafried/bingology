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

/** Evaluate single-line `const` statements together (PLAT is an expression that needs PCODE). */
function evalLines(script, names, want) {
  const code = names.map(n => {
    const start = script.indexOf(`const ${n} =`);
    if (start < 0) throw new Error(`legacy: ${n} not found`);
    return script.slice(start, script.indexOf("\n", start)).replace(`const ${n} =`, `globalThis.${n} =`);
  }).join("\n");
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return JSON.parse(JSON.stringify(ctx[want]));
}

export function parseLegacy(html) {
  const s = html.indexOf("<script>");
  const e = html.lastIndexOf("</script>");
  if (s < 0 || e < 0) throw new Error("legacy: <script> not found");
  const script = html.slice(s + 8, e);
  const d = Object.fromEntries(TABLES.map(t => [t, evalConst(script, t)]));
  d.PLAT = evalLines(script, ["PCODE", "PLAT"], "PLAT");
  return d;
}

const MINE_N = 60;
// Legacy "main home" categories → today's categories (the rest have no Israeli equivalent).
const PLAT_MAP = { netflix: "netflix", hbo: "hbo", apple: "apple", prime: "prime", disney: "disney", israel: "yes" };

/** Legacy tables → curated series entries (order preserved; tmdbId to be matched later). */
export function legacyToSeries(d) {
  return d.RAW.map((r, i) => {
    const [name, year, seasons, episodes, runtime, genres, moods, weight, solo, blurb] = r;
    const [imdb, rt, lang] = d.META[i];
    const more = d.MORE[i] || [];
    const lists = [];
    if (i < MINE_N) lists.push("mine");
    if (d.NYTR[i]) lists.push("nyt");
    const e = {
      tmdbId: null, name, year, lists,
      genres: genres.split(" "), moods: moods.split(" "),
      weight, solo: !!solo, blurb,
    };
    if (d.NYTR[i]) e.nytRank = d.NYTR[i];
    if (d.PRAISE[i]) e.praise = d.PRAISE[i];
    if (more[2] && more[2].length) e.awards = more[2];
    if (more[3]) e.castLabel = more[3];
    e.rt = rt ?? null;
    const names = x => (x ? x.split(", ").map(n => n.trim()).filter(Boolean) : []);
    e.fallback = { year, seasons, episodes, runtime, imdb, lang,
      creators: names(more[0]), cast: names(more[1]).map(name => ({ name, photo: null })),
      providers: [PLAT_MAP[d.PLAT[i]] ?? "other"] };
    return e;
  });
}
