#!/usr/bin/env bash
# Jalankan sebagai root setelah paket demo disiapkan di SOURCE_DIR.
set -euo pipefail

SOURCE_DIR=/home/deploy/erp-demo-prepared
APP_DIR=/var/www/erp-misjiwati-demo
DB_DIR=/var/lib/erp-misjiwati-demo
DOMAIN=demofarm.salmanrizwana.com
SITE=/etc/nginx/sites-available/erp-misjiwati-demo
READY=storage/app/demo-install-ready

if [[ "$EUID" -ne 0 ]]; then
    echo "Jalankan skrip ini sebagai root melalui console VPS." >&2
    exit 1
fi

if ! getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | grep -qx '187.53.134.155'; then
    echo "DNS $DOMAIN belum mengarah ke VPS ini." >&2
    exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
    if [[ ! -f "$SOURCE_DIR/$READY" || -e "$DB_DIR/database.sqlite" || -e "$SITE" ]]; then
        echo "Paket belum siap atau target demo sudah berisi data; pemasangan dihentikan." >&2
        exit 1
    fi
    mv "$SOURCE_DIR" "$APP_DIR"
elif [[ ! -f "$APP_DIR/$READY" ]]; then
    echo "Folder tujuan sudah ada dan bukan paket demo ini." >&2
    exit 1
fi

if [[ "$(git -c safe.directory="$APP_DIR" -C "$APP_DIR" rev-parse HEAD)" != "$(cat "$APP_DIR/$READY")" ]]; then
    echo "Versi paket tidak sesuai dengan versi yang sudah diuji." >&2
    exit 1
fi

chown -R deploy:www-data "$APP_DIR"
chmod -R g+rX,o-rwx "$APP_DIR"
chmod 640 "$APP_DIR/.env"
find "$APP_DIR/storage" "$APP_DIR/bootstrap/cache" -type d -exec chmod 2770 {} +
find "$APP_DIR/storage" "$APP_DIR/bootstrap/cache" -type f -exec chmod 660 {} +
install -d -m 2770 -o deploy -g www-data "$DB_DIR"

if [[ ! -f "$DB_DIR/database.sqlite" ]]; then
    install -m 660 -o deploy -g www-data "$APP_DIR/storage/app/demo-initial.sqlite" "$DB_DIR/database.sqlite"
fi

runuser -u deploy -- bash -c 'cd /var/www/erp-misjiwati-demo && php artisan optimize --no-interaction'
if [[ "$(sqlite3 "$DB_DIR/database.sqlite" 'PRAGMA integrity_check;')" != 'ok' ]]; then
    echo "Pemeriksaan database demo gagal." >&2
    exit 1
fi

install -d -m 755 /var/www/certbot/.well-known/acme-challenge

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    cat > "$SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name demofarm.salmanrizwana.com;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }
    location / { return 503; }
}
NGINX
    ln -sfn "$SITE" /etc/nginx/sites-enabled/erp-misjiwati-demo
    nginx -t
    systemctl reload nginx
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
        --non-interactive --agree-tos --keep-until-expiring
fi

PREVIOUS_CONFIG=$(mktemp)
if [[ -f "$SITE" ]]; then
    cp "$SITE" "$PREVIOUS_CONFIG"
fi
install -m 644 "$APP_DIR/deploy/nginx-demo.conf" "$SITE"
ln -sfn "$SITE" /etc/nginx/sites-enabled/erp-misjiwati-demo
if ! nginx -t; then
    cp "$PREVIOUS_CONFIG" "$SITE"
    rm -f "$PREVIOUS_CONFIG"
    echo "Konfigurasi demo gagal divalidasi; konfigurasi sebelumnya dipulihkan." >&2
    exit 1
fi
rm -f "$PREVIOUS_CONFIG"
systemctl reload nginx

curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 1 \
    --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/up" > /dev/null
echo "Demo aktif: https://$DOMAIN"
