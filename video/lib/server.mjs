// A tiny static server for the site folder, so the recorder never depends on another tool.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
};

/** Serves `root` on 127.0.0.1; port 0 picks a free one. Resolves to the real base URL. */
export function startServer(root, port = 0) {
  const base = resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      let file = resolve(join(base, decodeURIComponent(req.url.split("?")[0]))); // raw path, so "/../x" is caught below
      if (file !== base && !file.startsWith(base + sep)) throw 0;
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok({
      url: `http://127.0.0.1:${server.address().port}/`,
      close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }),
    }));
  });
}
