const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const handler = require("../api/wishes.js");

const originalEnvironment = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const originalFetch = global.fetch;

function makeResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

async function invoke(method, body, headers = {}) {
  const response = makeResponse();
  await handler({ method, body, headers }, response);
  return response;
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
});

test("requires the admin token before reading wishes", async () => {
  process.env.ADMIN_TOKEN = "test-admin-token";

  const response = await invoke("GET", undefined, {
    authorization: "Bearer incorrect-token",
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, "The admin password is incorrect.");
});

test("rejects invalid wishes before contacting Supabase", async () => {
  global.fetch = () => {
    throw new Error("The database must not be called for invalid input.");
  };

  const response = await invoke("POST", { wish: "  " });

  assert.equal(response.statusCode, 400);
});

test("reads wishes from Supabase only after admin authorization", async () => {
  process.env.ADMIN_TOKEN = "test-admin-token";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  global.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://example.supabase.co/rest/v1/wishes?select=name,wish,created_at&order=created_at.desc",
    );
    assert.equal(options.headers.Authorization, "Bearer test-service-key");
    return new Response(JSON.stringify([
      { name: "Friend", wish: "Happy birthday!", created_at: "2026-10-14T12:00:00Z" },
    ]), { status: 200 });
  };

  const response = await invoke("GET", undefined, {
    authorization: "Bearer test-admin-token",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.wishes, [{
    name: "Friend",
    wish: "Happy birthday!",
    createdAt: "2026-10-14T12:00:00Z",
  }]);
});

test("saves valid wishes in Supabase", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co/";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://example.supabase.co/rest/v1/wishes");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      name: "A friend",
      wish: "Happy birthday!",
    });
    return new Response(null, { status: 201 });
  };

  const response = await invoke("POST", { name: "", wish: " Happy birthday! " });

  assert.equal(response.statusCode, 201);
});
