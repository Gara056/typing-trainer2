"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

function loadDotEnv(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) return false;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
  return true;
}

loadDotEnv(path.join(__dirname, "..", ".env"));

const SYSTEM_PROMPT =
  "Ты проводник трансформационной игры Лила (самопознание, поле Хариша Джохари). Говори по-русски, тепло и точно, без гуру-позы и без диагнозов. Не выдумывай стрелы, змеи и номера клеток — опирайся только на переданный контекст партии. Клетка — зеркало запроса, не предсказание. Победа только на 68. Короткие партии из-за стрел 54→68 и 17→69 — закон поля, не баг. Ответ: 1–3 коротких абзаца, в конце один живой вопрос игроку.";

const LIMITS = {
  question: 400,
  context: 12000,
  history: 8,
  historyItem: 500,
  body: 20000,
  windowMs: 10 * 60 * 1000,
  maxPerWindow: 12,
  maxTokens: 700,
};

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function originAllowed(origin, allow) {
  if (!allow || allow === "*") return true;
  if (!origin) return false;
  return allow.split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

function createGuide(opts) {
  const fetchImpl = opts.fetch || fetch;
  const getKey = opts.getKey || (() => process.env.DEEPSEEK_API_KEY || "");
  const allowOrigin = opts.allowOrigin || process.env.GUIDE_ORIGIN || "*";
  const hits = new Map();

  function limited(ip, now) {
    const t = now || Date.now();
    const row = (hits.get(ip) || []).filter((x) => t - x < LIMITS.windowMs);
    if (row.length >= LIMITS.maxPerWindow) {
      hits.set(ip, row);
      return true;
    }
    row.push(t);
    hits.set(ip, row);
    return false;
  }

  function cors(req) {
    const origin = req.headers.origin || "";
    const allow = originAllowed(origin, allowOrigin) ? origin || allowOrigin : "";
    const headers = {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      Vary: "Origin",
    };
    if (allow && allow !== "*") headers["Access-Control-Allow-Origin"] = allow;
    else if (allowOrigin === "*") headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  function sanitize(payload) {
    const question = clip(payload && payload.question, LIMITS.question);
    if (question.length < 2) {
      const err = new Error("Нужен вопрос");
      err.status = 400;
      throw err;
    }
    const context = clip(payload && payload.context, LIMITS.context);
    const history = Array.isArray(payload && payload.history)
      ? payload.history.slice(-LIMITS.history).map((m) => ({
          role: m && m.role === "me" ? "user" : "assistant",
          content: clip(m && (m.text || m.content), LIMITS.historyItem),
        })).filter((m) => m.content)
      : [];
    if (payload && payload.messages) {
      const err = new Error("Системный промпт задаёт сервер");
      err.status = 400;
      throw err;
    }
    return { question, context, history };
  }

  async function complete(payload) {
    const key = String(getKey() || "").trim();
    if (!key) {
      const err = new Error("На сервере нет ключа DeepSeek");
      err.status = 503;
      throw err;
    }
    const { question, context, history } = sanitize(payload);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: "Контекст партии:\n" + (context || "(нет)") + "\n\nВопрос игрока: " + question,
      },
    ];
    const res = await fetchImpl("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.7,
        max_tokens: LIMITS.maxTokens,
        messages,
      }),
    });
    if (res.status === 401) {
      const err = new Error("ключ DeepSeek не принят");
      err.status = 502;
      throw err;
    }
    if (res.status === 402) {
      const err = new Error("на счёте DeepSeek нет средств");
      err.status = 502;
      throw err;
    }
    if (!res.ok) {
      const err = new Error("DeepSeek ответил " + res.status);
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    const text = (((data.choices || [])[0] || {}).message || {}).content || "";
    const answer = String(text).trim();
    if (!answer) {
      const err = new Error("пустой ответ модели");
      err.status = 502;
      throw err;
    }
    return { answer };
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let n = 0;
      req.on("data", (c) => {
        n += c.length;
        if (n > LIMITS.body) {
          reject(Object.assign(new Error("Слишком большой запрос"), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(Object.assign(new Error("Некорректный JSON"), { status: 400 }));
        }
      });
      req.on("error", reject);
    });
  }

  async function handle(req, res) {
    const headers = Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors(req));
    const send = (code, obj) => {
      res.writeHead(code, headers);
      res.end(JSON.stringify(obj));
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/api/guide" || url.pathname === "/api/guide/health")) {
      send(200, {
        ok: true,
        service: "leela-guide",
        deepseek: Boolean(String(getKey() || "").trim()),
      });
      return;
    }
    if (req.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/api/guide")) {
      send(404, { error: "not found" });
      return;
    }
    if (allowOrigin !== "*" && !originAllowed(req.headers.origin || "", allowOrigin)) {
      send(403, { error: "origin" });
      return;
    }
    if (limited(clientIp(req))) {
      send(429, { error: "too many requests" });
      return;
    }
    try {
      const payload = await readBody(req);
      const out = await complete(payload);
      send(200, out);
    } catch (err) {
      send(err.status || 500, { error: err.message || "error" });
    }
  }

  return { handle, complete, sanitize, limited, cors, hits, SYSTEM_PROMPT, LIMITS };
}

function listen(opts) {
  const port = Number((opts && opts.port) || process.env.PORT || 8787);
  const host = String((opts && opts.host) || process.env.HOST || "127.0.0.1");
  const key = String(process.env.DEEPSEEK_API_KEY || "").trim();
  const guide = createGuide(opts || {});
  const server = http.createServer(guide.handle);
  server.listen(port, host, () => {
    console.log("Leela guide on http://" + host + ":" + port + "/api/guide");
    console.log(key ? "DEEPSEEK_API_KEY: loaded (" + key.length + " chars)" : "DEEPSEEK_API_KEY: missing — copy .env.example to .env");
  });
  return server;
}

module.exports = { createGuide, listen, loadDotEnv, SYSTEM_PROMPT, LIMITS };

if (require.main === module) listen();
