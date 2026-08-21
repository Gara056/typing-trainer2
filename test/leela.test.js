"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "leela.html"), "utf8");

function load() {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://leela.local/leela.html?t=" + Math.random(),
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }
  return window;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log("ok  " + name);
    })
    .catch((err) => {
      console.error("fail  " + name);
      console.error(err && err.stack ? err.stack : err);
      process.exitCode = 1;
      throw err;
    });
}

(async () => {
  await test("DATA: 72 cells, psych keys, 10 arrows, 10 snakes", () => {
    const w = load();
    assert.strictEqual(w.DATA.cells.length, 72);
    assert.strictEqual(w.DATA.cells[0].n, 1);
    assert.strictEqual(w.DATA.cells[67].name, "Космическое Сознание");
    assert.strictEqual(w.DATA.arrows.length, 10);
    assert.strictEqual(w.DATA.snakes.length, 10);
    for (let n = 1; n <= 72; n++) {
      assert.ok(w.DATA.psych[String(n)], "psych " + n);
      assert.ok(w.DATA.cells[n - 1].d, "vedic " + n);
      assert.ok(w.DATA.cells[n - 1].sk, "sk " + n);
    }
  });

  await test("arrows and snakes stay within 1–72", () => {
    const w = load();
    for (const [from, to] of w.DATA.arrows.concat(w.DATA.snakes)) {
      assert.ok(from >= 1 && from <= 72, "from " + from);
      assert.ok(to >= 1 && to <= 72, "to " + to);
      assert.notStrictEqual(from, to);
    }
    const named = {
      10: 23, 17: 69, 20: 32, 22: 60, 27: 41, 28: 50, 37: 66, 45: 67, 46: 62, 54: 68,
      12: 8, 16: 4, 24: 7, 29: 6, 44: 9, 52: 35, 55: 3, 61: 13, 63: 2, 72: 51,
    };
    const map = Object.fromEntries(w.DATA.arrows.concat(w.DATA.snakes));
    for (const [k, v] of Object.entries(named)) {
      assert.strictEqual(map[k], v, "transition " + k);
    }
  });

  await test("dice faces 1–6 render; pips for 1, 5, 6", () => {
    const w = load();
    const counts = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    for (let n = 1; n <= 6; n++) {
      w.setDiceFace(n);
      const on = w.document.querySelectorAll("#dice .pip.on").length;
      assert.strictEqual(on, counts[n], "face " + n);
    }
    assert.strictEqual(w.document.querySelectorAll("#dice .pip").length, 9);
    w.setDiceFace(1);
    assert.strictEqual(w.document.querySelectorAll("#dice .pip.on").length, 1);
    w.setDiceFace(5);
    assert.strictEqual(w.document.querySelectorAll("#dice .pip.on").length, 5);
    w.setDiceFace(6);
    assert.strictEqual(w.document.querySelectorAll("#dice .pip.on").length, 6);
  });

  await test("entry only with a 6; 1–5 leave the token off-board", () => {
    const w = load();
    for (let r = 1; r <= 5; r++) {
      const out = w.applyRoll(r);
      assert.strictEqual(w.getState().pos, 0);
      assert.strictEqual(out.entered, false);
      assert.strictEqual(w.document.getElementById("token").classList.contains("hidden"), true);
    }
    const six = w.applyRoll(6);
    assert.strictEqual(six.entered, true);
    assert.strictEqual(w.getState().pos, 6);
    assert.strictEqual(w.document.getElementById("token").classList.contains("hidden"), false);
  });

  await test("applyRoll moves, caps at 72, follows arrows and snakes", () => {
    const w = load();
    w.applyRoll(6);
    w.applyRoll(4); // 10 → 23
    assert.strictEqual(w.getState().pos, 23);
    const hist = w.getState().history;
    assert.ok(hist.some((h) => h.n === 10 && h.kind === "move"));
    assert.ok(hist.some((h) => h.n === 23 && h.kind === "arrow"));

    w.resetGame();
    w.applyRoll(6);
    w.applyRoll(6); // 12 → 8
    assert.strictEqual(w.getState().pos, 8);

    w.resetGame();
    w.applyRoll(6);
    for (let i = 0; i < 11; i++) w.applyRoll(6); // 6+66=72
    assert.ok(w.getState().pos <= 72);
    assert.ok(w.getState().pos >= 1);
  });

  await test("game reaches cell 68 within 800 random rolls", () => {
    let won = false;
    for (let attempt = 0; attempt < 5 && !won; attempt++) {
      const w = load();
      for (let i = 0; i < 800 && !w.getState().won; i++) {
        w.applyRoll(1 + Math.floor(Math.random() * 6));
      }
      if (w.getState().pos === 68 && w.getState().won) won = true;
    }
    assert.ok(won, "did not reach 68 in 5×800 rolls");
  });

  await test("clicking a cell shows vedic and psychological text", () => {
    const w = load();
    w.document.querySelector('.cell[data-n="1"]').click();
    const body = w.document.getElementById("analysis-body").textContent;
    assert.ok(body.includes("Рождение"));
    assert.ok(body.includes(w.DATA.cells[0].d.slice(0, 24)));
    assert.ok(body.includes(w.DATA.psych["1"].slice(0, 24)));
    assert.ok(w.document.getElementById("analysis-vedic"));
    assert.ok(w.document.getElementById("analysis-psych"));
    w.document.querySelector('.cell[data-n="68"]').click();
    const b2 = w.document.getElementById("analysis-body").textContent;
    assert.ok(b2.includes("Космическое Сознание"));
    assert.ok(b2.includes(w.DATA.psych["68"].slice(0, 20)));
  });

  await test("history fills and current cell is highlighted", () => {
    const w = load();
    w.applyRoll(6);
    const chips = w.document.querySelectorAll("#history .chip");
    assert.ok(chips.length >= 1);
    const cur = w.document.querySelector(".cell.current");
    assert.ok(cur);
    assert.strictEqual(cur.dataset.n, "6");
    assert.ok([...chips].some((c) => c.classList.contains("now")));
  });

  await test("roll animation toggles rolling class and disables the button", async () => {
    const w = load();
    const btn = w.document.getElementById("btn-roll");
    const dice = w.document.getElementById("dice");
    assert.strictEqual(btn.disabled, false);
    w.roll();
    assert.strictEqual(dice.classList.contains("rolling"), true);
    assert.strictEqual(btn.disabled, true);
    await wait(750);
    assert.strictEqual(dice.classList.contains("rolling"), false);
    assert.strictEqual(w.getState().rolling, false);
    if (!w.getState().won && !w.getState().mustRead) {
      assert.strictEqual(btn.disabled, false);
    } else {
      assert.strictEqual(btn.disabled, true);
    }
  });

  await test("finale report follows the actual path and the query", () => {
    const w = load();
    w.document.getElementById("query").value = "мой выбор";
    w.applyRoll(6);
    for (let i = 0; i < 800 && !w.getState().won; i++) {
      w.applyRoll(1 + Math.floor(Math.random() * 6));
    }
    assert.ok(w.getState().won);
    const finale = w.document.getElementById("finale").textContent;
    assert.ok(finale.includes("мой выбор"));
    assert.ok(finale.includes("Заблуждение"));
    assert.ok(finale.includes("Космическое Сознание"));
    assert.ok(finale.includes("Ход за ходом") || finale.includes("клетка 68"));
    assert.ok(w.document.getElementById("win").classList.contains("show"));
    const names = [...new Set(w.getState().history.map((h) => w.DATA.cells[h.n - 1].name))];
    assert.ok(names.every((name) => finale.includes(name)));
  });

  await test("reset hides token, clears history, empties dice, unlocks query", () => {
    const w = load();
    w.document.getElementById("query").value = "мой запрос";
    w.applyRoll(6);
    w.applyRoll(3);
    w.setDiceFace(4);
    w.resetGame();
    const s = w.getState();
    assert.strictEqual(s.pos, 0);
    assert.strictEqual(s.history.length, 0);
    assert.strictEqual(s.queryLocked, false);
    assert.strictEqual(w.document.getElementById("token").classList.contains("hidden"), true);
    assert.strictEqual(w.document.querySelectorAll("#dice .pip.on").length, 0);
    assert.strictEqual(w.document.getElementById("query").disabled, false);
    assert.strictEqual(w.document.getElementById("query").value, "");
    assert.ok(w.document.getElementById("history").textContent.includes("Цепочка"));
    assert.strictEqual(w.document.querySelector(".cell.current"), null);
  });

  await test("unfinished game restores from localStorage", () => {
    const w = load();
    w.document.getElementById("query").value = "долгий путь";
    w.applyRoll(6);
    w.applyRoll(2);
    const pos = w.getState().pos;
    const n = w.getState().history.length;
    const dumped = w.localStorage.getItem(w.STORE);
    assert.ok(dumped);
    w.resetGame();
    assert.strictEqual(w.getState().pos, 0);
    w.localStorage.setItem(w.STORE, dumped);
    assert.ok(w.loadGame());
    assert.strictEqual(w.getState().pos, pos);
    assert.strictEqual(w.getState().history.length, n);
    assert.strictEqual(w.document.getElementById("query").value, "долгий путь");
    assert.strictEqual(w.document.getElementById("query").disabled, true);
  });

  await test("rules modal is titled Правила игры and speaks about meaning", () => {
    const w = load();
    const btn = w.document.getElementById("btn-rules");
    assert.ok(btn.textContent.includes("Правила"));
    const card = w.document.querySelector(".rules-card").textContent;
    assert.ok(card.includes("Правила игры"));
    assert.ok(card.includes("Подготовка"));
    assert.ok(card.includes("Записи ходов"));
    assert.ok(card.includes("Смысл, не финиш"));
    assert.ok(card.includes("зеркало"));
    assert.ok(card.includes("вернуться на клетку 68"));
    assert.ok(card.includes("69"));
    assert.ok(card.includes("камень") || card.includes("стихи"));
  });

  await test("guide answers about a cell, the query, and why games can be short", () => {
    const w = load();
    w.document.getElementById("query").value = "мой выбор";
    w.applyRoll(6);
    const cell = w.guideAsk("что значит клетка 54");
    assert.ok(cell.includes("54"));
    assert.ok(/бхакти/i.test(cell));
    assert.ok(cell.includes("мой выбор"));
    const named = w.guideAsk("бхакти");
    assert.ok(named.includes("54"));
    const why = w.guideAsk("Почему партия может закончиться быстро?");
    assert.ok(why.includes("54"));
    assert.ok(why.includes("68"));
    const rel = w.guideAsk("Что эта клетка говорит моему запросу?");
    assert.ok(rel.includes("Заблуждение") || rel.includes("мой выбор"));
    w.sendGuide("как читать мой путь?");
    const log = w.document.getElementById("chat-log").textContent;
    assert.ok(log.includes("как читать мой путь?"));
    assert.ok(log.includes("Заблуждение"));
    assert.ok(w.getState().chat.length >= 2);
  });

  await test("guide chat restores with the game", () => {
    const w = load();
    w.document.getElementById("query").value = "долгий путь";
    w.applyRoll(6);
    w.sendGuide("что значит стрела с 17?");
    const dumped = w.localStorage.getItem(w.STORE);
    assert.ok(dumped);
    assert.ok(dumped.includes("стрела с 17"));
    w.resetGame();
    assert.strictEqual(w.getState().chat.length, 0);
    w.localStorage.setItem(w.STORE, dumped);
    assert.ok(w.loadGame());
    assert.ok(w.document.getElementById("chat-log").textContent.includes("стрела с 17"));
    assert.ok(w.getState().chat.length >= 2);
  });

  await test("guide chat refreshes after the next move", () => {
    const w = load();
    w.document.getElementById("query").value = "мой выбор";
    w.applyRoll(6);
    w.sendGuide("что говорит эта клетка?");
    assert.ok(w.getState().chat.length >= 2);
    assert.ok(w.document.getElementById("chat-log").textContent.includes("что говорит эта клетка?"));
    w.liveCell();
    w.applyRoll(2);
    assert.strictEqual(w.getState().chat.length, 0);
    const log = w.document.getElementById("chat-log").textContent;
    assert.ok(!log.includes("что говорит эта клетка?"));
    assert.ok(log.includes(String(w.getState().pos)));
    assert.ok(w.document.querySelector(".guide-blurb"));
    assert.ok(/юнгиан|архетип|тень|регресс/i.test(w.GUIDE_SYSTEM));
  });

  await test("elemental charm sits on cell 68 without blocking the board", () => {
    const w = load();
    const charm = w.document.getElementById("charm");
    assert.ok(charm);
    assert.ok(w.document.querySelector('.cell[data-n="68"]').contains(charm));
    assert.strictEqual(w.getComputedStyle(charm).pointerEvents, "none");
    assert.ok(!charm.classList.contains("show"));
    w.setCharm("earth");
    assert.strictEqual(w.getState().charm, "earth");
    assert.ok(charm.classList.contains("show"));
    assert.ok(charm.querySelector("svg"));
    assert.ok(w.document.getElementById("charm-hint").textContent.includes("Земля"));
    w.document.querySelector('.cell[data-n="68"]').click();
    assert.ok(w.document.getElementById("analysis-body").textContent.includes("Космическое Сознание"));
    w.applyRoll(6);
    assert.strictEqual(w.document.querySelector('#charms button[data-charm="water"]').disabled, true);
    const dumped = w.localStorage.getItem(w.STORE);
    assert.ok(dumped.includes("earth"));
    w.resetGame();
    assert.strictEqual(w.getState().charm, "");
    assert.ok(!w.document.getElementById("charm").classList.contains("show"));
    w.localStorage.setItem(w.STORE, dumped);
    assert.ok(w.loadGame());
    assert.strictEqual(w.getState().charm, "earth");
    assert.ok(w.document.getElementById("charm").classList.contains("show"));
    assert.ok(w.guideAsk("что значит талисман").includes("Земля"));
  });

  await test("DeepSeek uses the player's key and game context, falls back locally", async () => {
    const w = load();
    w.document.getElementById("query").value = "мой выбор";
    w.applyRoll(6);
    const ctx = w.buildGuideContext("клетка 6");
    assert.ok(ctx.includes("мой выбор"));
    assert.ok(ctx.includes("Заблуждение"));
    assert.strictEqual(w.getAiKey(), "");

    let sent;
    w.fetch = async (url, opts) => {
      sent = { url, opts };
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "Зеркало мохи к запросу." } }] }),
      };
    };
    w.setAiKey("sk-test-leela");
    await w.sendGuide("что говорит эта клетка?");
    assert.ok(sent.url.includes("api.deepseek.com"));
    assert.ok(sent.opts.headers.Authorization.includes("sk-test-leela"));
    const body = JSON.parse(sent.opts.body);
    assert.ok(body.messages[1].content.includes("мой выбор"));
    assert.ok(w.document.getElementById("chat-log").textContent.includes("Зеркало мохи"));
    assert.ok(!w.localStorage.getItem(w.STORE).includes("sk-test-leela"));

    w.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await w.sendGuide("как играть?");
    assert.ok(w.document.getElementById("chat-log").textContent.includes("Семь опор"));
  });

  await test("hosted guide API never sends the DeepSeek key from the browser", async () => {
    const w = load();
    w.LEELA_GUIDE_API = "https://guide.example/api/guide";
    w.paintAiStatus();
    w.document.getElementById("query").value = "мой выбор";
    w.applyRoll(6);
    let sent;
    w.fetch = async (url, opts) => {
      sent = { url, opts };
      return {
        ok: true,
        status: 200,
        json: async () => ({ answer: "Сервер разобрал клетку 6." }),
      };
    };
    await w.sendGuide("что говорит эта клетка?");
    assert.strictEqual(sent.url, "https://guide.example/api/guide");
    assert.ok(!sent.opts.headers.Authorization);
    const body = JSON.parse(sent.opts.body);
    assert.ok(body.question);
    assert.ok(body.context.includes("мой выбор"));
    assert.ok(!body.messages);
    assert.ok(w.document.getElementById("chat-log").textContent.includes("Сервер разобрал"));
    assert.ok(w.getGuideApi());
  });

  await test("finale can be packed into a standalone HTML file", () => {
    const w = load();
    w.document.getElementById("query").value = "сохранить разбор";
    w.applyRoll(6);
    for (let i = 0; i < 800 && !w.getState().won; i++) {
      w.applyRoll(1 + Math.floor(Math.random() * 6));
    }
    assert.ok(w.getState().won);
    const doc = w.buildFinaleDocument();
    assert.ok(doc.includes("<!DOCTYPE html>"));
    assert.ok(doc.includes("сохранить разбор"));
    assert.ok(doc.includes("Космическое Сознание"));
    assert.ok(w.buildFinaleText().includes("сохранить разбор"));
  });

  if (process.exitCode) {
    console.error("\n" + passed + " passed before failure");
    process.exit(1);
  }
  console.log("\n" + passed + " tests passed");
})().catch(() => process.exit(1));
