#!/bin/bash
# Установка игры и проводника DeepSeek на VPS Beget.
#
# Чистый VPS:
#   wget -O /tmp/install-beget.sh https://raw.githubusercontent.com/Gara056/typing-trainer2/cursor/leela-rules-guide-fbce/server/install-beget.sh
#   sudo bash /tmp/install-beget.sh
#
# Уже есть OpenClaw (nginx + порт 18789) — тот же скрипт, на вопрос про OpenClaw ответьте y:
#   sudo bash /tmp/install-beget.sh
#   или: sudo EXISTING_OPENCLAW=1 bash /tmp/install-beget.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт от root: sudo bash /tmp/install-beget.sh"
  exit 1
fi

REPO="${REPO:-https://github.com/Gara056/typing-trainer2.git}"
BRANCH="${BRANCH:-cursor/leela-rules-guide-fbce}"
APP_DIR="${APP_DIR:-/var/www/leela}"
ASK="${ASK:-/dev/tty}"
EXISTING_OPENCLAW="${EXISTING_OPENCLAW:-}"

if [ ! -r "$ASK" ]; then
  ASK="/dev/stdin"
fi

if [ -z "$EXISTING_OPENCLAW" ]; then
  read -r -p "На этом VPS уже работает OpenClaw (nginx на 18789)? [y/N]: " EXISTING_OPENCLAW < "$ASK"
  EXISTING_OPENCLAW="${EXISTING_OPENCLAW:-n}"
fi
case "${EXISTING_OPENCLAW,,}" in
  y|yes|1|да) EXISTING_OPENCLAW=1 ;;
  *) EXISTING_OPENCLAW=0 ;;
esac

if [ "$EXISTING_OPENCLAW" = 1 ]; then
  echo ""
  echo "Режим «рядом с OpenClaw»:"
  echo "  • конфиг OpenClaw не трогаем;"
  echo "  • default-сайт nginx не удаляем;"
  echo "  • Лила — на ОТДЕЛЬНОМ поддомене (не на том же, что панель OpenClaw)."
  echo ""
  read -r -p "Поддомен для Лилы (например leela.ваш-домен.ru): " DOMAIN < "$ASK"
else
  read -r -p "Домен сайта (например leela.example.ru): " DOMAIN < "$ASK"
fi

DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
if [ -z "$DOMAIN" ]; then
  echo "Нужен домен с A-записью на IP этой VPS."
  exit 1
fi

read -r -s -p "Ключ DeepSeek (ввод не виден, потом Enter): " KEY < "$ASK"
echo
if [ -z "$KEY" ]; then
  echo "Без ключа проводник DeepSeek не запустится."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
if [ "$EXISTING_OPENCLAW" = 1 ]; then
  apt-get install -y git curl ca-certificates python3
  if ! command -v nginx >/dev/null 2>&1; then
    apt-get install -y nginx
  fi
else
  apt-get install -y nginx git curl ca-certificates python3
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH" || true
else
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

umask 077
cat > "$APP_DIR/.env" <<EOF
DEEPSEEK_API_KEY=$KEY
GUIDE_ORIGIN=https://$DOMAIN
HOST=127.0.0.1
PORT=8787
EOF
unset KEY

python3 - <<PY
from pathlib import Path
old = 'window.LEELA_GUIDE_API = window.LEELA_GUIDE_API || "";'
new = 'window.LEELA_GUIDE_API = window.LEELA_GUIDE_API || "/api/guide";'
ok = False
for name in ("leela.html", "index.html"):
    p = Path("$APP_DIR") / name
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if old not in t:
        raise SystemExit(f"не нашёл строку LEELA_GUIDE_API в {name}")
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print(f"{name}: LEELA_GUIDE_API = /api/guide")
    ok = True
if not ok:
    raise SystemExit("нет leela.html / index.html")
PY

chown -R www-data:www-data "$APP_DIR"
chmod 600 "$APP_DIR/.env"

NODE_BIN="$(command -v node)"
sed "s|/usr/bin/node|$NODE_BIN|" "$APP_DIR/server/leela-guide.service" > /etc/systemd/system/leela-guide.service
systemctl daemon-reload
systemctl enable --now leela-guide
systemctl restart leela-guide

NGINX_TEMPLATE="$APP_DIR/server/nginx.leela-subdomain.conf.example"
if [ "$EXISTING_OPENCLAW" = 0 ] && [ -f "$APP_DIR/server/nginx.leela.conf.example" ]; then
  NGINX_TEMPLATE="$APP_DIR/server/nginx.leela.conf.example"
fi
sed "s/LEELA_DOMAIN.ru/$DOMAIN/g; s/YOUR_DOMAIN.ru/$DOMAIN/g" "$NGINX_TEMPLATE" > /etc/nginx/sites-available/leela
ln -sfn /etc/nginx/sites-available/leela /etc/nginx/sites-enabled/leela
if [ "$EXISTING_OPENCLAW" = 0 ]; then
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
   certbot --nginx -d "$DOMAIN"; then
  echo "Сертификат для $DOMAIN установлен."
else
  echo "HTTPS пока не выписался. Добавьте A-запись $DOMAIN → IP VPS, затем:"
  echo "  certbot --nginx -d $DOMAIN"
fi

echo
if [ "$EXISTING_OPENCLAW" = 1 ]; then
  echo "Лила установлена рядом с OpenClaw."
  echo "OpenClaw: свой домен → :18789 (не меняли)."
  echo "Лила:     https://$DOMAIN → статика + /api/guide → :8787"
else
  echo "Готово. Откройте https://$DOMAIN"
fi
echo "Проверка: curl -sS https://$DOMAIN/api/guide/health"
echo "Служба: systemctl status leela-guide"
echo "Ключ лежит только в $APP_DIR/.env"
