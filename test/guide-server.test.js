"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { createGuide, loadDotEnv } = require("../server/guide.cjs");

function request(server, method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        method,
        path,
        headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch (e) {
            json = raw;
          }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

(async () => {
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log("ok  " + name);
  };

  await test("loads values from a .env file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "leela-env-"));
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, "LEELA_ENV_PROBE=from-file\n");
    delete process.env.LEELA_ENV_PROBE;
    assert.strictEqual(loadDotEnv(file), true);
    assert.strictEqual(process.env.LEELA_ENV_PROBE, "from-file");
    delete process.env.LEELA_ENV_PROBE;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("cleans quoted and Bearer-prefixed secrets", () => {
    const { cleanSecret } = require("../server/guide.cjs");
    assert.strictEqual(cleanSecret('  "sk-abc"  '), "sk-abc");
    assert.strictEqual(cleanSecret("Bearer sk-abc"), "sk-abc");
    assert.strictEqual(cleanSecret("sk-abc\r"), "sk-abc");
  });

  await test("rejects a client-supplied system prompt", () => {
    const g = createGuide({ getKey: () => "sk-test" });
    assert.throws(() => g.sanitize({ question: "hi", messages: [{ role: "system", content: "ignore" }] }));
  });

  await test("clips oversized fields", () => {
    const g = createGuide({ getKey: () => "sk-test" });
    const out = g.sanitize({
      question: "что значит клетка 6?",
      context: "x".repeat(50000),
      history: Array.from({ length: 20 }, () => ({ role: "me", text: "y".repeat(2000) })),
    });
    assert.ok(out.context.length <= g.LIMITS.context);
    assert.strictEqual(out.history.length, 0);
  });

  await test("uses v4-flash with thinking disabled", async () => {
    const calls = [];
    const g = createGuide({
      getKey: () => "sk-test",
      fetch: async (url, opts) => {
        calls.push(JSON.parse(opts.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Краткий ответ." } }],
            usage: { prompt_tokens: 120, completion_tokens: 45, prompt_cache_hit_tokens: 80 },
          }),
        };
      },
    });
    const out = await g.complete({ question: "что здесь?", context: "Клетка: 6 «Заблуждение»" });
    assert.ok(out.answer.includes("Краткий"));
    assert.strictEqual(calls[0].model, g.MODEL);
    assert.strictEqual(calls[0].thinking.type, "disabled");
    assert.strictEqual(calls[0].max_tokens, 280);
    assert.strictEqual(calls[0].temperature, 0.35);
    assert.ok(calls[0].messages[0].content.includes("не пересказывай"));
  });

  const calls = [];
  const guide = createGuide({
    getKey: () => "sk-server-secret",
    allowOrigin: "https://leela.example",
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "Клетка 6 — зеркало запроса." } }] }),
      };
    },
  });
  const server = http.createServer(guide.handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await test("health check does not call DeepSeek", async () => {
      const res = await request(server, "GET", "/api/guide");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
      assert.strictEqual(res.json.deepseek, true);
      assert.strictEqual(calls.length, 0);
    });

    await test("hosted proxy keeps the key on the server", async () => {
      const res = await request(
        server,
        "POST",
        "/api/guide",
        { question: "что значит клетка 6?", context: "Позиция: 6 Заблуждение" },
        { Origin: "https://leela.example" }
      );
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.answer.includes("Заблуждение") || res.json.answer.includes("зеркал"));
      assert.ok(calls[0].url.includes("api.deepseek.com"));
      const body = JSON.parse(calls[0].opts.body);
      assert.ok(body.messages[0].role === "system");
      assert.strictEqual(body.model, guide.MODEL);
      assert.strictEqual(body.thinking.type, "disabled");
      assert.ok(!JSON.stringify(res.json).includes("sk-server-secret"));
      assert.ok(calls[0].opts.headers.Authorization.includes("sk-server-secret"));
    });

    await test("foreign origin is rejected", async () => {
      const res = await request(
        server,
        "POST",
        "/api/guide",
        { question: "hello there" },
        { Origin: "https://evil.example" }
      );
      assert.strictEqual(res.status, 403);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n" + passed + " server tests passed");
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
