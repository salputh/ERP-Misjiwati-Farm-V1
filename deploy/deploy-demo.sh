#!/usr/bin/env bash
#
# Deploy script khusus untuk demo environment ERP Misjiwati Farm
#
# Perbedaan dari deploy production:
# - Menggunakan folder /var/www/erp-misjiwati-demo
# - Database di /var/lib/erp-misjiwati-demo
# - Tidak perlu backup database (data demo bisa di-regenerate)
# - Optional: reset database ke state awal setiap deploy
#
# Usage:
#   cd /var/www/erp-misjiwati-demo
#   ./deploy/deploy-demo.sh
#
# atau dengan reset database:
#   RESET_DB=true ./deploy/deploy-demo.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/erp-misjiwati-demo}"
BRANCH="${BRANCH:-demo/portfolio}"
RESET_DB="${RESET_DB:-false}"

cd "$APP_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploy Demo ERP Misjiwati Farm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Mode pemeliharaan
echo "🔧 Mengaktifkan mode pemeliharaan..."
php artisan down --retry=60 --refresh=5 || true

# 2. Git pull
echo "📥 Menarik kode terbaru dari branch $BRANCH..."
git fetch origin
BEFORE=$(git rev-parse HEAD)
git reset --hard "origin/$BRANCH"
AFTER=$(git rev-parse HEAD)

if [[ "$BEFORE" == "$AFTER" ]]; then
    echo "✓ Tidak ada perubahan kode"
else
    echo "✓ Update dari $BEFORE ke $AFTER"
    git log --oneline --no-walk "$AFTER"
fi

# 3. Install dependencies
echo "📦 Memasang dependency PHP..."
composer install --no-dev --optimize-autoloader --no-interaction

echo "📦 Memasang dependency JS..."
npm ci

# 4. Build assets
echo "🔨 Mem-build aset frontend..."
npm run build

# 5. Database handling
if [[ "$RESET_DB" == "true" ]]; then
    echo "🗄️  RESET DATABASE: Menghapus dan membuat ulang database demo..."

    # Hapus database lama
    DB_PATH=$(php artisan tinker --execute="echo config('database.connections.sqlite.database');")
    if [[ -f "$DB_PATH" ]]; then
        rm -f "$DB_PATH"
        rm -f "${DB_PATH}-wal"
        rm -f "${DB_PATH}-shm"
        echo "✓ Database lama dihapus"
    fi

    # Buat database baru
    touch "$DB_PATH"
    chmod 660 "$DB_PATH"
    chgrp www-data "$DB_PATH"

    # Migrasi dan seed
    echo "🌱 Menjalankan migrasi dan seeding data demo..."
    php artisan migrate --force
    php artisan db:seed --force --class=DemoSeeder
    echo "✓ Database demo berhasil di-reset"
else
    echo "🗄️  Menjalankan migrasi database..."
    php artisan migrate --force
    echo "✓ Migrasi selesai"
fi

# 6. Optimasi Laravel
echo "⚡ Membuat cache konfigurasi, route, dan view..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 7. Reload PHP-FPM
echo "🔄 Me-reload PHP-FPM..."
sudo systemctl reload php8.5-fpm

# 8. Buka aplikasi
echo "✅ Membuka aplikasi..."
php artisan up

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Deploy demo berhasil!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 URL: https://demo.misjiwatifarm.tech"
echo "🔐 Login demo:"
echo "   Email: demo@misjiwatifarm.tech"
echo "   Password: DemoMisjiwati2026"
echo ""

if [[ "$RESET_DB" == "true" ]]; then
    echo "⚠️  Database telah di-reset ke state awal"
    echo ""
fi

echo "💡 Tips:"
echo "   - Untuk reset database: RESET_DB=true ./deploy/deploy-demo.sh"
echo "   - Cek log: tail -f storage/logs/laravel-$(date +%Y-%m-%d).log"
echo "   - Health check: curl https://demo.misjiwatifarm.tech/up"
echo ""
