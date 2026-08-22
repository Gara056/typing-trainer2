"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

function cleanSecret(value) {
  let v = String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  if (/^bearer\s+/i.test(v)) v = v.replace(/^bearer\s+/i, "").trim();
  return v;
}

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
    let v = cleanSecret(t.slice(i + 1));
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
  return true;
}

loadDotEnv(path.join(__dirname, "..", ".env"));

const SYSTEM_PROMPT =
  "Ты проводник игры Лила (поле Хариша Джохари). Говори по-русски. Сначала отвечай на вопрос игрока; шаг N/3 — только линза, не сценарий. Три оптики: 1) юнгианская (тень, Самость, персона, анимус/анима, индивидуация); 2) регрессивная (возраст/ранний опыт); 3) архетипическая (клетка как образ/сцена, не приговор). Не эзотерика, не нумерология, не предсказания, не диагнозы, не гуру-поза. Не выдумывай стрелы/змеи/номера. Не пересказывай карточку клетки и не цитируй якорь дословно. Не повторяй прошлые ответы — если уже сказано, углуби или смести акцент. Свяжи клетку с запросом партии. 3–5 предложений, конкретно. Шаги: 1 архетип, 2 тень/персона, 3 регрессия + смысл для запроса и мягко к следующему броску. На шаге 3 новую тему не открывай.";

const LIMITS = {
  question: 400,
  context: 3200,
  history: 4,
  historyItem: 280,
  body: 16000,
  windowMs: 10 * 60 * 1000,
  maxPerWindow: 12,
  maxTokensOffPeak: Number(process.env.GUIDE_MAX_TOKENS) || 320,
  maxTokensPeak: Number(process.env.GUIDE_MAX_TOKENS_PEAK) || 220,
  temperature: Number(process.env.GUIDE_TEMPERATURE) || 0.45,
};

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

// DeepSeek peak hours (UTC): 01:00–04:00 and 06:00–10:00. From 2026-08-23 Beijing
// weekends are off-peak all day. Peak ≈ 2× off-peak.
const WEEKEND_OFFPEAK_FROM = Date.UTC(2026, 7, 22, 16, 0, 0); // 00:00 BJT Aug 23

function isDeepSeekPeak(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60;
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  const weekend = bj.getUTCDay() === 0 || bj.getUTCDay() === 6;
  if (weekend && d.getTime() >= WEEKEND_OFFPEAK_FROM) return false;
  return (utc >= 1 && utc < 4) || (utc >= 6 && utc < 10);
}

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

function logUsage(data, meta) {
  const u = data && data.usage;
  if (!u) return;
  const row = {
    model: MODEL,
    peak: !!(meta && meta.peak),
    prompt: u.prompt_tokens,
    completion: u.completion_tokens,
    cached: u.prompt_cache_hit_tokens || u.prompt_tokens_details?.cached_tokens || 0,
  };
  if (data.usage.completion_tokens_details?.reasoning_tokens) {
    row.reasoning = data.usage.completion_tokens_details.reasoning_tokens;
  }
  console.log("[guide] usage " + JSON.stringify(row));
}

function createGuide(opts) {
  const fetchImpl = opts.fetch || fetch;
  const getKey = opts.getKey || (() => process.env.DEEPSEEK_API_KEY || "");
  const allowOrigin = opts.allowOrigin || process.env.GUIDE_ORIGIN || "*";
  const nowFn = opts.now || (() => new Date());
  const hits = new Map();

  function limited(ip, now) {
    const t = (now && now.getTime) ? now.getTime() : Date.now();
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

  function sanitize(payload, peak) {
    const question = clip(payload && payload.question, LIMITS.question);
    if (question.length < 2) {
      const err = new Error("Нужен вопрос");
      err.status = 400;
      throw err;
    }
    const context = clip(payload && payload.context, LIMITS.context);
    const histMax = peak ? 2 : LIMITS.history;
    const history = histMax > 0 && Array.isArray(payload && payload.history)
      ? payload.history.slice(-histMax).map((m) => ({
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
    const key = cleanSecret(getKey());
    if (!key) {
      const err = new Error("На сервере нет ключа DeepSeek");
      err.status = 503;
      throw err;
    }
    const peak = isDeepSeekPeak(nowFn());
    const { question, context, history } = sanitize(payload, peak);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: "Контекст партии:\n" + (context || "(нет)") + "\n\nВопрос игрока: " + question,
      },
    ];
    const maxTokens = peak ? LIMITS.maxTokensPeak : LIMITS.maxTokensOffPeak;
    const res = await fetchImpl("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: LIMITS.temperature,
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
        messages,
      }),
    });
    if (res.status === 401) {
      console.error("DeepSeek rejected API key (HTTP 401). Check DEEPSEEK_API_KEY in .env");
      const err = new Error("ключ DeepSeek не принят");
      err.status = 502;
      throw err;
    }
    if (res.status === 402) {
      console.error("DeepSeek billing/insufficient balance (HTTP 402)");
      const err = new Error("на счёте DeepSeek нет средств");
      err.status = 502;
      throw err;
    }
    if (!res.ok) {
      console.error("DeepSeek HTTP " + res.status);
      const err = new Error("DeepSeek ответил " + res.status);
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    logUsage(data, { peak });
    const msg = (((data.choices || [])[0] || {}).message || {});
    const text = String(msg.content || "").trim();
    if (!text) {
      const err = new Error("пустой ответ модели");
      err.status = 502;
      throw err;
    }
    return { answer: text, peak };
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
      const peak = isDeepSeekPeak(nowFn());
      send(200, {
        ok: true,
        service: "leela-guide",
        model: MODEL,
        peak,
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
    if (limited(clientIp(req), nowFn())) {
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

  return {
    handle,
    complete,
    sanitize,
    limited,
    cors,
    hits,
    SYSTEM_PROMPT,
    LIMITS,
    MODEL,
    logUsage,
    isDeepSeekPeak,
  };
}

function listen(opts) {
  const port = Number((opts && opts.port) || process.env.PORT || 8787);
  const host = String((opts && opts.host) || process.env.HOST || "127.0.0.1");
  const key = String(process.env.DEEPSEEK_API_KEY || "").trim();
  const guide = createGuide(opts || {});
  const server = http.createServer(guide.handle);
  server.listen(port, host, () => {
    const peak = isDeepSeekPeak();
    console.log("Leela guide on http://" + host + ":" + port + "/api/guide");
    console.log(
      "Model: " + MODEL +
      " · thinking disabled · off-peak max_tokens " + LIMITS.maxTokensOffPeak +
      " · peak max_tokens " + LIMITS.maxTokensPeak +
      " · now " + (peak ? "PEAK (×2)" : "off-peak")
    );
    console.log(key ? "DEEPSEEK_API_KEY: loaded (" + key.length + " chars)" : "DEEPSEEK_API_KEY: missing — copy .env.example to .env");
  });
  return server;
}

module.exports = {
  createGuide,
  listen,
  loadDotEnv,
  cleanSecret,
  SYSTEM_PROMPT,
  LIMITS,
  MODEL,
  logUsage,
  isDeepSeekPeak,
};

if (require.main === module) listen();
