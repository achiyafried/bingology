import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { stampJs, stampHtml, unstamped, stampSite } from "../scripts/stamp.mjs";

const V = "abc123";

test("stampJs versions static, side-effect and dynamic relative imports", () => {
  const src = [
    `import { a, b } from "./lib/score.js";`,
    `import * as guess from '../lib/games/guess.js';`,
    `import "./side.js";`,
    `const m = await import("./views/mine.js");`,
    `import(  "../lib/account/client.js" ).then(f);`,
    `import {\n  x,\n  y\n} from "./multi.js";`,
  ].join("\n");
  assert.equal(stampJs(src, V), [
    `import { a, b } from "./lib/score.js?v=abc123";`,
    `import * as guess from '../lib/games/guess.js?v=abc123';`,
    `import "./side.js?v=abc123";`,
    `const m = await import("./views/mine.js?v=abc123");`,
    `import(  "../lib/account/client.js?v=abc123" ).then(f);`,
    `import {\n  x,\n  y\n} from "./multi.js?v=abc123";`,
  ].join("\n"));
});

test("stampJs leaves CDN imports, variables, data fetches and comments alone", () => {
  const src = [
    `import x from "https://cdn.jsdelivr.net/npm/foo@1.0.0/+esm";`,
    `clientP = import(CDN);`,
    `fetch("data.json", { cache: "no-cache" });`,
    "fetchFn(`games/${date}.json`);",
    `// Loaded by app.js with import() only.`,
  ].join("\n");
  assert.equal(stampJs(src, V), src);
});

test("stampHtml versions local script and stylesheet URLs only", () => {
  const html = [
    `<link href="https://fonts.googleapis.com/css2?family=Assistant" rel="stylesheet">`,
    `<link rel="stylesheet" href="styles.css">`,
    `<script type="module" src="app.js"></script>`,
    `<a href="privacy.html">x</a>`,
  ].join("\n");
  assert.equal(stampHtml(html, V), [
    `<link href="https://fonts.googleapis.com/css2?family=Assistant" rel="stylesheet">`,
    `<link rel="stylesheet" href="styles.css?v=abc123">`,
    `<script type="module" src="app.js?v=abc123"></script>`,
    `<a href="privacy.html">x</a>`,
  ].join("\n"));
});

test("unstamped reports relative .js specifiers the rewrite missed", () => {
  assert.deepEqual(unstamped(`import("./ok.js?v=1"); import(\`./tpl.js\`);`), ["./tpl.js"]);
  assert.deepEqual(unstamped(stampJs(`import { a } from "./a.js";`, V)), []);
});

const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test("stampSite copies the tree, stamps code, keeps data byte-identical", () => {
  const root = mkdtempSync(join(tmpdir(), "stamp-"));
  const src = join(root, "site"), out = join(root, "out");
  mkdirSync(join(src, "lib"), { recursive: true });
  writeFileSync(join(src, "index.html"), `<script type="module" src="app.js"></script>`);
  writeFileSync(join(src, "app.js"), `import { q } from "./lib/quiz.js";`);
  writeFileSync(join(src, "lib", "quiz.js"), `export const q = 1;`);
  writeFileSync(join(src, "data.json"), `{"x":"./a.js"}`);
  stampSite(src, out, V);
  assert.equal(readFileSync(join(out, "index.html"), "utf8"), `<script type="module" src="app.js?v=abc123"></script>`);
  assert.equal(readFileSync(join(out, "app.js"), "utf8"), `import { q } from "./lib/quiz.js?v=abc123";`);
  assert.equal(readFileSync(join(out, "lib", "quiz.js"), "utf8"), `export const q = 1;`);
  assert.equal(readFileSync(join(out, "data.json"), "utf8"), `{"x":"./a.js"}`);
  assert.equal(readFileSync(join(src, "app.js"), "utf8"), `import { q } from "./lib/quiz.js";`, "source untouched");
});

test("stampSite fails on a relative import it cannot stamp", () => {
  const root = mkdtempSync(join(tmpdir(), "stamp-"));
  const src = join(root, "site");
  mkdirSync(src);
  writeFileSync(join(src, "app.js"), "import(`./views/${name}.js`);");
  assert.throws(() => stampSite(src, join(root, "out"), V), /app\.js.*\.\/views/);
});

test("stampSite rejects unsafe versions", () => {
  assert.throws(() => stampSite("site", "unused", `x" onload="y`), /version/);
});

test("the real site stamps cleanly: every module specifier and index.html entry is versioned", () => {
  const out = join(mkdtempSync(join(tmpdir(), "stamp-")), "out");
  stampSite("site", out, V);
  const js = walk(out).filter(p => p.endsWith(".js"));
  assert.ok(js.length > 10);
  let count = 0;
  for (const p of js) {
    const code = readFileSync(p, "utf8");
    assert.deepEqual(unstamped(code), [], relative(out, p));
    count += (code.match(/\?v=abc123/g) || []).length;
  }
  assert.ok(count > 40, `expected many stamped specifiers, got ${count}`);
  const html = readFileSync(join(out, "index.html"), "utf8");
  assert.match(html, /src="app\.js\?v=abc123"/);
  assert.match(html, /href="styles\.css\?v=abc123"/);
});
