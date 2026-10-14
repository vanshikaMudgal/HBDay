const { timingSafeEqual } = require("node:crypto");

function sendJson(response, statusCode, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(statusCode).json(value);
}

function isAuthorized(request) {
  const expectedToken = process.env.ADMIN_TOKEN || "";
  if (!expectedToken) return false;

  const authorization = request.headers.authorization || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  return { url: url.replace(/\/+$/, ""), key };
}

async function supabaseRequest(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase request failed:", response.status, details);
    throw new Error("The wishes database request failed.");
  }
  return response;
}

module.exports = async function handler(request, response) {
  if (request.method === "POST") {
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(response, 400, { error: "Please send a name and wish." });
      return;
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const wish = typeof body.wish === "string" ? body.wish.trim() : "";
    if (!wish || wish.length > 2000) {
      sendJson(response, 400, { error: "Write a wish of up to 2,000 characters before sending." });
      return;
    }
    if (name.length > 80) {
      sendJson(response, 400, { error: "Name must be 80 characters or fewer." });
      return;
    }

    try {
      const { url, key } = getSupabaseConfig();
      await supabaseRequest(`${url}/rest/v1/wishes`, key, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ name: name || "A friend", wish }),
      });
      sendJson(response, 201, { message: "Your wish has been saved." });
    } catch (error) {
      console.error("Unable to save birthday wish:", error);
      sendJson(response, 500, { error: "We couldn't save your wish. Please try again." });
    }
    return;
  }

  if (request.method === "GET") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, {
        error: process.env.ADMIN_TOKEN
          ? "The admin password is incorrect."
          : "Set ADMIN_TOKEN in the deployment environment to enable the wishes inbox.",
      });
      return;
    }

    try {
      const { url, key } = getSupabaseConfig();
      const databaseResponse = await supabaseRequest(
        `${url}/rest/v1/wishes?select=name,wish,created_at&order=created_at.desc`,
        key,
      );
      const rows = await databaseResponse.json();
      sendJson(response, 200, {
        wishes: rows.map((row) => ({
          name: row.name,
          wish: row.wish,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      console.error("Unable to read birthday wishes:", error);
      sendJson(response, 500, { error: "We couldn't load the wishes right now." });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "Method not allowed." });
};
