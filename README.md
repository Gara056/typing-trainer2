# Лила — игра самопознания

Интерактивная веб-версия трансформационной игры «Лила» (по книге Хариша Джохари). Один самодостаточный файл, без сборки.

Откройте [`leela.html`](leela.html) в браузере — офлайн, с диска. Проводник отвечает локально.

## Безопасный DeepSeek

Ключ API **нельзя** вшивать в HTML и нельзя отдавать всем посетителям. Иначе любой скопирует его из кода и будет тратить ваш баланс.

Правильная схема:

1. Игра — статический сайт (`leela.html`).
2. Рядом — маленький сервер `server/guide.cjs`. Он один знает `DEEPSEEK_API_KEY`.
3. Браузер шлёт только вопрос и контекст партии на `/api/guide`. Ключа в запросе нет.
4. Сервер сам собирает системный промпт, режет длину, ограничивает частоту с одного IP.

```bash
cp .env.example .env   # впишите ключ с platform.deepseek.com
npm run guide          # читает .env сам, http://127.0.0.1:8787/api/guide
```

Файл `.env` в git не попадает. В облачной сессии его тоже нет — ключ нужно положить на ту машину, где крутится `npm run guide`. Не присылайте ключ в чат.

## VPS Beget

Ключ живёт только на сервере. Из Cursor на ваш Beget зайти нельзя: нет SSH и нет IP. Установку запускаете **вы на VPS**.

### Уже есть OpenClaw на этом же VPS

OpenClaw обычно слушает **127.0.0.1:18789** и отдаётся через nginx с WebSocket на **своём** домене (например `ai.ваш-домен.ru`). Лила не конфликтует: проводник на **127.0.0.1:8787**, статика в `/var/www/leela`.

**Важно:** дайте Лиле **отдельный поддомен** (`leela.ваш-домен.ru`), не тот же URL, что панель OpenClaw.

1. В DNS Beget: A-запись `leela` → IP VPS (OpenClaw не трогайте).
2. SSH на сервер, запустите установщик; на вопрос про OpenClaw ответьте **y** и укажите поддомен Лилы.

```bash
ssh root@IP_ВАШЕГО_VPS
wget -O /tmp/install-beget.sh https://raw.githubusercontent.com/Gara056/typing-trainer2/cursor/leela-rules-guide-fbce/server/install-beget.sh
sudo bash /tmp/install-beget.sh
# или сразу: sudo EXISTING_OPENCLAW=1 bash /tmp/install-beget.sh
```

Скрипт **не** удалит конфиг OpenClaw и **не** снимет `default` nginx. Проверка: `curl -sS https://leela.ваш-домен.ru/api/guide/health`.

### Чистый VPS (без OpenClaw)

```bash
ssh root@IP_ВАШЕГО_VPS
wget -O /tmp/install-beget.sh https://raw.githubusercontent.com/Gara056/typing-trainer2/cursor/leela-rules-guide-fbce/server/install-beget.sh
sudo bash /tmp/install-beget.sh
```

Скрипт спросит домен и ключ DeepSeek (ввод ключа не видно), поставит Node, nginx, systemd, Let's Encrypt и пропишет `LEELA_GUIDE_API = '/api/guide'`. Ключ в чат не копируйте.

Проверка: `curl -sS https://ваш-домен.ru/api/guide/health` → `ok`, `deepseek: true`. Игра: `https://ваш-домен.ru/`. В карточке «Проводник» — «ключ на сервере».

Личный ключ в карточке проводника — только для игры у себя на компьютере, не для публичного сайта.

## Правила

1. Введите запрос — с чем входите в игру.
2. Чтобы выйти на поле, нужна **шестёрка**.
3. Фишка идёт на N клеток; сверх 72 останавливается на 72.
4. Стрелы поднимают, змеи опускают.
5. Победа — клетка **68, Космическое Сознание**.

## Тесты

```bash
npm install
npm test
```
