const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, timingSafeEqual } = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const WISHES_FILE = path.join(DATA_DIR, "wishes.jsonl");
const MAX_BODY_BYTES = 8 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function isAuthorized(request) {
  if (!ADMIN_TOKEN) return false;
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const supplied = Buffer.from(token);
  const expected = Buffer.from(ADMIN_TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Please send valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function saveWish(wish) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(WISHES_FILE, `${JSON.stringify(wish)}\n`, "utf8");
}

async function readWishes() {
  let contents;
  try {
    contents = await fs.readFile(WISHES_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .reverse();
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL." });
    return;
  }

  if (decodedPath === "/") decodedPath = "/index.html";
  if (decodedPath === "/admin") decodedPath = "/admin.html";

  const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType =
      MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );

  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    sendJson(response, 400, { error: "Invalid URL." });
    return;
  }

  if (url.pathname === "/api/wishes" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        sendJson(response, 400, { error: "Please send a name and wish." });
        return;
      }
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const wishText = typeof body.wish === "string" ? body.wish.trim() : "";

      if (!wishText || wishText.length > 2000) {
        sendJson(response, 400, {
          error: "Write a wish of up to 2,000 characters before sending.",
        });
        return;
      }
      if (name.length > 80) {
        sendJson(response, 400, { error: "Name must be 80 characters or fewer." });
        return;
      }

      const wish = {
        id: randomUUID(),
        name: name || "A friend",
        wish: wishText,
        createdAt: new Date().toISOString(),
      };
      await saveWish(wish);
      sendJson(response, 201, { message: "Your wish has been saved." });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        error:
          error.statusCode ? error.message : "We couldn't save your wish. Please try again.",
      });
      if (!error.statusCode) console.error("Unable to save birthday wish:", error);
    }
    return;
  }

  if (url.pathname === "/api/wishes" && request.method === "GET") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, {
        error: ADMIN_TOKEN
          ? "The admin password is incorrect."
          : "Set ADMIN_TOKEN on the server to enable the wishes inbox.",
      });
      return;
    }
    try {
      sendJson(response, 200, { wishes: await readWishes() });
    } catch (error) {
      console.error("Unable to read birthday wishes:", error);
      sendJson(response, 500, { error: "We couldn't load the wishes right now." });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error("Unable to serve request:", error);
    sendJson(response, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, () => {
  console.log(`Birthday Notes is running at http://localhost:${PORT}`);
  if (!ADMIN_TOKEN) {
    console.warn("Set ADMIN_TOKEN before sharing the app to enable the private wishes inbox.");
  }
});
