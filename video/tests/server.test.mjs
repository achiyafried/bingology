import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../lib/server.mjs";

const dir = await mkdtemp(join(tmpdir(), "tour-srv-"));
await writeFile(join(dir, "index.html"), "<h1>hi</h1>");
await writeFile(join(dir, "a.json"), "{}");
const srv = await startServer(dir, 0);
after(() => srv.close());

const raw = path => new Promise((res, rej) => {
  const u = new URL(srv.url);
  http.request({ host: u.hostname, port: u.port, path }, r => { let b = ""; r.on("data", c => b += c); r.on("end", () => res({ status: r.statusCode, type: r.headers["content-type"] || "", body: b })); }).on("error", rej).end();
});

test("url uses a real free port", () => {
  assert.match(srv.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.notEqual(new URL(srv.url).port, "0");
});
test("/ serves index.html as html", async () => {
  const r = await raw("/");
  assert.equal(r.status, 200);
  assert.equal(r.body, "<h1>hi</h1>");
  assert.ok(r.type.startsWith("text/html"));
});
test("json gets a json type", async () => {
  assert.ok((await raw("/a.json")).type.startsWith("application/json"));
});
test("paths outside the root are 404", async () => {
  assert.equal((await raw("/../package.json")).status, 404);
  assert.equal((await raw("/%2e%2e/package.json")).status, 404);
});
test("missing file is 404", async () => {
  assert.equal((await raw("/missing.js")).status, 404);
});
