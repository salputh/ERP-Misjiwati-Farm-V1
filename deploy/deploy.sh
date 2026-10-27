#!/usr/bin/env bash
#
# Deploy ERP Misjiwati Farm di VPS. Jalankan sebagai user aplikasi (mis. deploy) dari mana saja:
#   /var/www/erp-misjiwati/deploy/deploy.sh
#
# Urutan: mode pemeliharaan -> backup database -> tarik kode -> dependency -> build aset ->
# migrasi -> cache -> reload PHP-FPM -> aplikasi dibuka kembali.
# Bila salah satu langkah gagal, skrip berhenti dan aplikasi TETAP dalam mode pemeliharaan,
# supaya tidak ada yang menulis data ke versi setengah jadi. Ikuti "Rollback" di DEPLOY.md.
# Seeder tidak pernah dijalankan di sini.
#
# Variabel (punya nilai bawaan):
#   APP_DIR          folder aplikasi                (/var/www/erp-misjiwati)
#   BRANCH           branch yang di-deploy          (main)
#   PHP_FPM_SERVICE  nama service PHP-FPM           (php8.5-fpm)

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/erp-misjiwati}"
BRANCH="${BRANCH:-main}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.5-fpm}"

log() {
    echo "[$(date '+%H:%M:%S')] $*"
}

trap 'log "GAGAL pada baris $LINENO. Aplikasi masih dalam mode pemeliharaan; lihat bagian Rollback di deploy/DEPLOY.md."' ERR

cd "$APP_DIR"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    log "GAGAL: ada perubahan lokal di $APP_DIR. Server tidak boleh diedit langsung."
    exit 1
fi

SEBELUMNYA="$(git rev-parse HEAD)"
echo "$SEBELUMNYA" > storage/app/deploy-sebelumnya
log "Versi sekarang: $SEBELUMNYA"

log "Mode pemeliharaan"
php artisan down --retry=60

log "Backup database sebelum migrasi"
DB_PATH="$(grep -E '^DB_DATABASE=' .env | cut -d= -f2- | tr -d '"')"
DB_PATH="${DB_PATH:?DB_DATABASE belum diisi di .env}" "$APP_DIR/scripts/backup-sqlite.sh"

log "Menarik kode branch $BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
log "Versi baru: $(git rev-parse HEAD)"

log "Dependency PHP"
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

log "Build aset"
npm ci --no-audit --no-fund
npm run build

log "Migrasi database"
php artisan migrate --force

log "Cache config, route, view, event"
php artisan optimize

log "Reload $PHP_FPM_SERVICE (mengosongkan OPcache)"
sudo systemctl reload "$PHP_FPM_SERVICE"

php artisan up
APP_URL="$(grep -E '^APP_URL=' .env | cut -d= -f2- | tr -d '"')"
log "Selesai. Periksa kesehatan: curl -fsS $APP_URL/up"
