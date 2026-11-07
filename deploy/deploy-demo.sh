#!/usr/bin/env bash
# Deploy branch demo/portfolio. RESET_DB=true hanya untuk mereset data demo.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/erp-misjiwati-demo}"
BRANCH="${BRANCH:-demo/portfolio}"
RESET_DB="${RESET_DB:-false}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.5-fpm}"

cd "$APP_DIR"
trap 'echo "Deploy gagal pada baris $LINENO; periksa aplikasi sebelum menjalankan php artisan up." >&2' ERR

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "Ada perubahan lokal; deploy dihentikan agar perubahan tidak tertimpa." >&2
    exit 1
fi

php artisan config:clear --no-interaction
DB_PATH=$(php -r '
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$path = config("database.connections.sqlite.database");
if (!config("app.demo_mode") || $app->environment("production") || config("database.default") !== "sqlite"
    || !is_string($path) || dirname($path) !== "/var/lib/erp-misjiwati-demo" || is_link($path)
    || !is_file($path) || realpath($path) !== $path) {
    fwrite(STDERR, "Konfigurasi bukan database demo yang terisolasi. Deploy dibatalkan.\n");
    exit(1);
}
echo $path;
')

php artisan down --retry=60 --refresh=5

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"

composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
npm ci --no-audit --no-fund
npm run build

if [[ "$RESET_DB" == "true" ]]; then
    php artisan migrate:fresh --force --seed --seeder=DemoSeeder --no-interaction
else
    php artisan migrate --force --no-interaction
fi

php artisan optimize --no-interaction
sudo systemctl reload "$PHP_FPM_SERVICE"
php artisan up

echo "Deploy selesai. Periksa: https://demofarm.salmanrizwana.com/up"
