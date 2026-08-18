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

Игру и проводник держите на одном сервере. Ключ DeepSeek слушает только localhost.

С компьютера (IP и пароль root — в панели Beget):

```bash
ssh root@IP_ВАШЕГО_VPS
```

На сервере:

```bash
apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

mkdir -p /var/www/leela
git clone https://github.com/Gara056/typing-trainer2.git /var/www/leela
cd /var/www/leela
git checkout cursor/leela-rules-guide-fbce
cp .env.example .env
nano .env
chown -R www-data:www-data /var/www/leela
chmod 600 /var/www/leela/.env
```

В `.env`:

```
DEEPSEEK_API_KEY=ваш_ключ
GUIDE_ORIGIN=https://ваш-домен.ru
HOST=127.0.0.1
PORT=8787
```

В `leela.html` (начало файла):

```html
window.LEELA_GUIDE_API = "https://ваш-домен.ru/api/guide";
```

```bash
cp /var/www/leela/server/leela-guide.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now leela-guide

cp /var/www/leela/server/nginx.leela.conf.example /etc/nginx/sites-available/leela
# в файле замените YOUR_DOMAIN.ru на свой домен
ln -sf /etc/nginx/sites-available/leela /etc/nginx/sites-enabled/leela
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш-домен.ru
```

Домен в панели Beget должен смотреть на IP этой VPS. Проверка: `systemctl status leela-guide`.

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
