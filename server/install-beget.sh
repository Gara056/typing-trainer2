#!/bin/bash
# Установка игры и проводника DeepSeek на VPS Beget.
# Запускать на сервере от root, не в чате Cursor:
#   wget -O /tmp/install-beget.sh https://raw.githubusercontent.com/Gara056/typing-trainer2/cursor/leela-rules-guide-fbce/server/install-beget.sh
#   sudo bash /tmp/install-beget.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт от root: sudo bash /tmp/install-beget.sh"
  exit 1
fi

REPO="${REPO:-https://github.com/Gara056/typing-trainer2.git}"
BRANCH="${BRANCH:-cursor/leela-rules-guide-fbce}"
APP_DIR="${APP_DIR:-/var/www/leela}"
ASK="${ASK:-/dev/tty}"

if [ ! -r "$ASK" ]; then
  ASK="/dev/stdin"
fi

read -r -p "Домен сайта (например leela.example.ru): " DOMAIN < "$ASK"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN%%/*}"
if [ -z "$DOMAIN" ]; then
  echo "Нужен домен, который в панели Beget смотрит на IP этой VPS."
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
apt-get install -y nginx git curl ca-certificates python3
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

sed "s/YOUR_DOMAIN.ru/$DOMAIN/g" "$APP_DIR/server/nginx.leela.conf.example" > /etc/nginx/sites-available/leela
ln -sfn /etc/nginx/sites-available/leela /etc/nginx/sites-enabled/leela
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
   certbot --nginx -d "$DOMAIN"; then
  echo "Сертификат установлен."
else
  echo "HTTPS пока не выписался. Проверьте, что домен в Beget указывает на этот IP, затем:"
  echo "  certbot --nginx -d $DOMAIN"
fi

echo
echo "Готово. Откройте https://$DOMAIN"
echo "Проверка: curl -sS https://$DOMAIN/api/guide/health"
echo "Служба: systemctl status leela-guide"
echo "Ключ лежит только в $APP_DIR/.env"
