/* A tiny zero-dependency static file server for the bureau. */

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"]
]);

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname = "/";
  try {
    const url = new URL(request.url || "/", "http://" + (request.headers.host || host));
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, "." + pathname);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME.get(extension) || "application/octet-stream",
      "Content-Length": data.byteLength,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else response.end(data);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><meta charset='utf-8'><title>404</title>" +
      "<style>body{background:#ede7da;color:#19231f;font-family:serif;padding:12vw;line-height:1.8}" +
      "a{color:#cf5136}</style><h1>这一页没有天气。</h1><p>臆候局找不到你要找的档案。</p><p><a href='/'>回到观测台</a></p>"
    );
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("Port " + port + " is already in use. Try: PORT=4174 npm start");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log("");
  console.log("  臆候局 · THE BUREAU OF IMAGINED WEATHER");
  console.log("  http://" + host + ":" + port);
  console.log("  按 Ctrl+C 关闭观测窗。");
  console.log("");
});
