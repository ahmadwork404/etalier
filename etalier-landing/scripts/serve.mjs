import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url || "/", "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory())
      file = path.join(file, "index.html");
    let bytes = await readFile(file).catch(() => null);
    if (!bytes && !path.extname(file)) {
      file += ".html";
      bytes = await readFile(file).catch(() => null);
    }
    if (!bytes) {
      res
        .writeHead(404, { "Content-Type": "text/plain" })
        .end("Page not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res.writeHead(400).end("Invalid request");
  }
});
server.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Etalier landing: http://localhost:" + (process.env.PORT || 3001),
    ),
);
