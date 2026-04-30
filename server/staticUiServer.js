import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "4173", 10);
const APP_DIR = process.env.APP_DIR || process.cwd();
const DIST_DIR = path.resolve(APP_DIR, "dist");
const API_ORIGIN = process.env.TIKPAL_API_ORIGIN || "http://127.0.0.1:8787";
const INDEX_FILE = path.join(DIST_DIR, "index.html");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendPlainText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(message),
  });
  response.end(message);
}

function setCacheHeaders(response, filePath) {
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  response.setHeader("Cache-Control", "no-cache");
}

function resolveStaticFile(requestPathname) {
  const decodedPath = decodeURIComponent(requestPathname);
  const sanitizedPath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const relativePath = sanitizedPath.replace(/^[/\\]+/, "");
  const candidatePath = path.resolve(DIST_DIR, relativePath);

  if (!candidatePath.startsWith(DIST_DIR)) {
    return null;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  return null;
}

function serveFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  response.statusCode = 200;
  response.setHeader("Content-Type", contentType);
  setCacheHeaders(response, filePath);

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) {
      sendPlainText(response, 500, "Failed to read static asset.");
      return;
    }
    response.destroy();
  });
  stream.pipe(response);
}

function proxyApiRequest(request, response, pathnameWithQuery) {
  const targetUrl = new URL(pathnameWithQuery, API_ORIGIN);
  const transport = targetUrl.protocol === "https:" ? https : http;

  const headers = { ...request.headers, host: targetUrl.host, "x-tikpal-local-ui": "1" };

  const upstreamRequest = transport.request(
    targetUrl,
    {
      method: request.method,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on("error", (error) => {
    sendPlainText(response, 502, `Upstream API proxy failed: ${error.message}`);
  });

  request.pipe(upstreamRequest);
}

function createServer() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error(`Missing built UI at ${INDEX_FILE}. Run "npm run build" before starting the web service.`);
  }

  return http.createServer((request, response) => {
    if (!request.url) {
      sendPlainText(response, 400, "Missing request URL.");
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;
    const pathnameWithQuery = `${pathname}${requestUrl.search}`;

    if (pathname.startsWith("/api/v1/")) {
      proxyApiRequest(request, response, pathnameWithQuery);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendPlainText(response, 405, "Method not allowed.");
      return;
    }

    const filePath = resolveStaticFile(pathname);
    if (filePath) {
      serveFile(response, filePath);
      return;
    }

    serveFile(response, INDEX_FILE);
  });
}

const server = createServer();
server.listen(PORT, HOST, () => {
  console.log(`tikpal static UI listening on http://${HOST}:${PORT}`);
  console.log(`serving dist from ${DIST_DIR}`);
  console.log(`proxying /api/v1/* to ${API_ORIGIN}`);
});
