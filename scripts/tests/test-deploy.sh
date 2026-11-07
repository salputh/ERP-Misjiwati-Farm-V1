#!/usr/bin/env bash
#
# Uji skrip deploy dan rollback di sandbox lokal. TIDAK menyentuh server produksi:
# memakai transport local, repositori fixture, artisan palsu, SQLite sementara, dan server HTTP lokal
# untuk pemeriksaan kesehatan. Dijalankan dari mana saja: scripts/tests/test-deploy.sh
#
# Kebutuhan: bash, git, php, sqlite3, curl, tar, gzip.

set -euo pipefail

ASAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
PORT="${TEST_PORT:-$((20000 + RANDOM % 20000))}"
LULUS=0
GAGAL=0
SERVER_PID=""

bersih() {
    if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
    rm -rf "$TMP"
}
trap bersih EXIT

ok() {
    LULUS=$((LULUS + 1))
    echo "  ok   $*"
}

salah() {
    GAGAL=$((GAGAL + 1))
    echo "  GAGAL $*" >&2
}

assert_true() {
    local deskripsi="$1"
    shift
    if "$@" >/dev/null 2>&1; then ok "$deskripsi"; else salah "$deskripsi"; fi
}

assert_contains() {
    local deskripsi="$1" teks="$2" isi="$3"
    if grep -qF -- "$isi" <<< "$teks"; then ok "$deskripsi"; else salah "$deskripsi (tidak memuat: $isi)"; fi
}

# jalankan <deskripsi> <kode keluar yang diharapkan: 0|gagal> <perintah...>
KELUARAN=""
jalankan() {
    local deskripsi="$1" harapan="$2"
    shift 2
    local kode=0
    KELUARAN="$("$@" 2>&1)" || kode=$?
    if [[ "$harapan" == "0" && $kode -eq 0 ]] || [[ "$harapan" == "gagal" && $kode -ne 0 ]]; then
        ok "$deskripsi"
    else
        salah "$deskripsi (kode keluar $kode)"
        echo "$KELUARAN" | tail -8 >&2
    fi
}

echo "Sandbox: $TMP (port $PORT)"
for perintah in git php sqlite3 curl tar gzip; do
    command -v "$perintah" >/dev/null || { echo "perintah '$perintah' tidak ada"; exit 1; }
done

# ---------- fixture ----------
export APP_ROOT="$TMP/app"
BACKUP="$TMP/backups"
DB="$TMP/app-data.sqlite"
mkdir -p "$APP_ROOT/shared" "$BACKUP"

cat > "$APP_ROOT/shared/.env" <<ENV
APP_ENV=production
DB_CONNECTION=sqlite
DB_DATABASE=$DB
SECRET_MARKER=jangan-diubah-oleh-deploy
ENV
cp "$APP_ROOT/shared/.env" "$TMP/env.asli"

git init -q --bare "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/work" 2>/dev/null
cd "$TMP/work"
git config user.email uji@lokal.test
git config user.name Uji
git checkout -q -b main

mkdir -p public database/migrations bootstrap/cache scripts
cp -R "$ASAL/scripts/." scripts/
rm -rf scripts/tests
echo ok > public/up
cat > artisan <<'PHP'
#!/usr/bin/env php
<?php
// artisan palsu untuk uji: meniru migrate, down, up, optimize pada SQLite nyata.
$perintah = $argv[1] ?? '';
$akar = __DIR__;
$env = parse_ini_file($akar.'/.env', false, INI_SCANNER_RAW);
$db = $env['DB_DATABASE'];
$sql = fn (string $q) => trim((string) shell_exec('sqlite3 '.escapeshellarg($db).' '.escapeshellarg($q)));
switch ($perintah) {
    case 'migrate':
        foreach (glob($akar.'/database/migrations/*gagal*.php') as $rusak) { fwrite(STDERR, "migrasi rusak: $rusak\n"); exit(1); }
        $sql('create table if not exists migrations (id integer primary key, migration text, batch integer)');
        foreach (glob($akar.'/database/migrations/*.php') as $berkas) {
            $nama = basename($berkas, '.php');
            if ($sql("select count(*) from migrations where migration='$nama'") === '0') {
                $sql("insert into migrations (migration, batch) values ('$nama', 1)");
                echo "migrated $nama\n";
            }
        }
        break;
    case 'down':
        touch($akar.'/storage/framework/down');
        break;
    case 'up':
        @unlink($akar.'/storage/framework/down');
        break;
    case 'optimize':
        @mkdir($akar.'/bootstrap/cache', 0777, true);
        file_put_contents($akar.'/bootstrap/cache/optimized', 'ok');
        break;
    default:
        fwrite(STDERR, "perintah tidak dikenal: $perintah\n");
        exit(1);
}
PHP
chmod +x artisan
touch database/migrations/2026_01_01_000000_dasar.php
git add -A
git commit -q -m "v1"
git push -q origin main
V1="$(git rev-parse HEAD)"

# database produksi awal: migrasi dasar sudah tercatat
sqlite3 "$DB" "create table migrations (id integer primary key, migration text, batch integer); insert into migrations (migration, batch) values ('2026_01_01_000000_dasar', 1);"

# server HTTP untuk health check: membaca lewat symlink current, 503 saat mode pemeliharaan
cat > "$TMP/router.php" <<'PHP'
<?php
$akar = getenv('APP_ROOT');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$berkas = $akar.'/current/public'.$path;
if (is_file($akar.'/shared/storage/framework/down')) { http_response_code(503); echo 'maintenance'; return true; }
if (is_file($berkas)) { echo file_get_contents($berkas); return true; }
http_response_code(404);
PHP
php -S "127.0.0.1:$PORT" "$TMP/router.php" >/dev/null 2>&1 &
SERVER_PID=$!

cat > "$TMP/ci-status.sh" <<CI
#!/usr/bin/env bash
cat "$TMP/ci-status" 2>/dev/null || echo tidak-ada
CI
chmod +x "$TMP/ci-status.sh"
echo success > "$TMP/ci-status"

export DEPLOY_TRANSPORT=local
export HEALTH_URL="http://127.0.0.1:$PORT"
export HEALTH_PATHS="/up"
export HEALTH_RETRIES=2
export HEALTH_DELAY=1
export PHP_FPM_SERVICE=""
export BACKUP_DIR="$BACKUP"
export BUILD_CMD=true
export COMPOSER_CMD=true
export DEPLOY_CI_STATUS_CMD="$TMP/ci-status.sh"
export DEPLOY_SOURCE_BRANCH=main

DEPLOY="$TMP/work/scripts/deploy.sh"
ROLLBACK="$TMP/work/scripts/rollback.sh"
for _ in 1 2 3; do curl -s -o /dev/null "$HEALTH_URL/up" && break; sleep 1; done

arus_id() { basename "$(readlink "$APP_ROOT/current")"; }

assert_aktif() {
    if [[ "$(arus_id)" == "$1" ]]; then ok "$2"; else salah "$2"; fi
}

# ---------- skenario ----------
echo "== rencana (plan) hanya membaca"
jalankan "plan berjalan" 0 "$DEPLOY" plan "$V1"
assert_contains "plan memuat judul" "$KELUARAN" "DEPLOYMENT PLAN"
assert_contains "plan memuat commit target" "$KELUARAN" "$V1"
assert_contains "plan memuat status CI" "$KELUARAN" "success"
assert_contains "plan memuat strategi rollback" "$KELUARAN" "Strategi rollback"
assert_true "plan tidak membuat folder rilis" test ! -d "$APP_ROOT/releases"

echo "== current awal menunjuk ke aplikasi lama (bukan rilis berversi)"
mkdir -p "$TMP/legacy/public"
echo ok > "$TMP/legacy/public/index.php"
ln -s "$TMP/legacy" "$APP_ROOT/current"
jalankan "plan tetap jalan bila current adalah aplikasi lama" 0 "$DEPLOY" plan "$V1"
assert_contains "plan menyebut commit produksi tidak diketahui" "$KELUARAN" "tidak diketahui"
jalankan "link-legacy dry-run tidak mengubah apa pun" 0 env APP_ROOT="$TMP/dry2" LEGACY_APP="$TMP/legacy" "$ASAL/scripts/server-setup.sh" link-legacy
assert_true "dry-run link-legacy tidak membuat symlink" test ! -e "$TMP/dry2"
rm -rf "$APP_ROOT/current.tmp"

echo "== persetujuan dan prasyarat"
jalankan "ditolak tanpa persetujuan" gagal "$DEPLOY" run "$V1"
assert_contains "pesan minta persetujuan" "$KELUARAN" "belum disetujui"
assert_true "tidak ada rilis terbuat" test ! -d "$APP_ROOT/releases"
jalankan "ditolak bila persetujuan untuk commit lain" gagal env DEPLOY_APPROVED_SHA=0000000000000000000000000000000000000000 "$DEPLOY" run "$V1"

echo "failure" > "$TMP/ci-status"
jalankan "ditolak bila CI gagal" gagal env DEPLOY_APPROVED_SHA="$V1" "$DEPLOY" run "$V1"
assert_contains "pesan CI" "$KELUARAN" "CI belum lulus"
echo "pending" > "$TMP/ci-status"
jalankan "ditolak bila CI belum selesai" gagal env DEPLOY_APPROVED_SHA="$V1" "$DEPLOY" run "$V1"
echo "success" > "$TMP/ci-status"

echo "perubahan" >> "$TMP/work/public/up"
jalankan "ditolak bila ada perubahan lokal" gagal env DEPLOY_APPROVED_SHA="$V1" "$DEPLOY" run "$V1"
assert_contains "pesan perubahan lokal" "$KELUARAN" "perubahan lokal"
git -C "$TMP/work" checkout -q -- public/up

echo "lokal" > "$TMP/work/lokal.txt"
git -C "$TMP/work" add lokal.txt
git -C "$TMP/work" commit -q -m "belum di-push"
BELUM_PUSH="$(git -C "$TMP/work" rev-parse HEAD)"
jalankan "ditolak bila commit belum ada di origin/main" gagal env DEPLOY_APPROVED_SHA="$BELUM_PUSH" "$DEPLOY" run "$BELUM_PUSH"
assert_contains "pesan origin/main" "$KELUARAN" "origin/main"
git -C "$TMP/work" reset -q --hard "$V1"

echo "== deploy pertama (tanpa migrasi baru)"
jalankan "deploy v1 sukses" 0 env DEPLOY_APPROVED_SHA="$V1" "$DEPLOY" run "$V1"
ID1="$(arus_id)"
assert_true "symlink current mengarah ke rilis" test -d "$APP_ROOT/current/public"
assert_true "current sekarang menunjuk ke rilis berversi" bash -c "readlink '$APP_ROOT/current' | grep -q '^releases/'"
assert_true "aplikasi lama tidak dicatat sebagai rilis sebelumnya" test ! -s "$APP_ROOT/previous"
assert_true "aplikasi lama tidak tersentuh" test -f "$TMP/legacy/public/index.php"
assert_true "REVISION berisi sha" grep -qx "$V1" "$APP_ROOT/current/REVISION"
assert_true ".env rilis adalah symlink ke shared" test -L "$APP_ROOT/releases/$ID1/.env"
assert_true "storage rilis adalah symlink ke shared" test -L "$APP_ROOT/releases/$ID1/storage"
assert_true ".env produksi tidak berubah" diff -q "$TMP/env.asli" "$APP_ROOT/shared/.env"
assert_true "backup dibuat" bash -c "ls '$BACKUP'/database-predeploy-*.sqlite.gz"
assert_true "backup valid" bash -c "gzip -t '$BACKUP'/database-predeploy-*.sqlite.gz"
assert_true "rilis tercatat sehat" grep -qx "$ID1" "$APP_ROOT/releases.ok"
assert_true "log deploy mencatat sukses" grep -q "deploy SUKSES id=$ID1" "$APP_ROOT/deploy.log"
assert_true "tidak ada mode pemeliharaan tersisa" test ! -e "$APP_ROOT/shared/storage/framework/down"
assert_true "cache dibuat" test -f "$APP_ROOT/current/bootstrap/cache/optimized"

echo "== idempotensi"
JUMLAH_SEBELUM="$(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
jalankan "deploy ulang commit yang sama tidak melakukan apa pun" 0 env DEPLOY_APPROVED_SHA="$V1" "$DEPLOY" run "$V1"
assert_contains "pesan sudah aktif" "$KELUARAN" "sudah menjadi rilis aktif"
JUMLAH_SESUDAH="$(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
if [[ "$JUMLAH_SEBELUM" == "$JUMLAH_SESUDAH" ]]; then ok "jumlah rilis tetap"; else salah "jumlah rilis berubah"; fi

echo "== deploy dengan migrasi baru"
cd "$TMP/work"
touch database/migrations/2026_02_01_000000_tambah_kolom.php
git add -A && git commit -q -m "v2 migrasi" && git push -q origin main
V2="$(git rev-parse HEAD)"
jalankan "plan menyebut migrasi" 0 "$DEPLOY" plan "$V2"
assert_contains "plan memuat berkas migrasi" "$KELUARAN" "2026_02_01_000000_tambah_kolom"
assert_contains "plan memuat perintah persetujuan migrasi" "$KELUARAN" "DEPLOY_APPROVED_MIGRATIONS=yes"
jalankan "ditolak tanpa persetujuan migrasi" gagal env DEPLOY_APPROVED_SHA="$V2" "$DEPLOY" run "$V2"
assert_contains "pesan migrasi" "$KELUARAN" "DEPLOY_APPROVED_MIGRATIONS=yes"
assert_aktif "$ID1" "rilis aktif tidak berubah setelah penolakan"
assert_true "migrasi belum dijalankan" bash -c "! sqlite3 '$DB' 'select migration from migrations' | grep -q tambah_kolom"
jalankan "deploy v2 dengan persetujuan migrasi" 0 env DEPLOY_APPROVED_SHA="$V2" DEPLOY_APPROVED_MIGRATIONS=yes "$DEPLOY" run "$V2"
ID2="$(arus_id)"
assert_true "migrasi tercatat di database" bash -c "sqlite3 '$DB' 'select migration from migrations' | grep -q tambah_kolom"
assert_true "mode pemeliharaan dicabut" test ! -e "$APP_ROOT/shared/storage/framework/down"
assert_true "rilis sebelumnya tercatat" grep -qx "$ID1" "$APP_ROOT/previous"
assert_true "rilis v1 tetap ada" test -d "$APP_ROOT/releases/$ID1"
assert_true "ada dua backup" test "$(find "$BACKUP" -name '*.sqlite.gz' | wc -l | tr -d ' ')" -ge 2

echo "== kegagalan health check"
git rm -q public/up && git commit -q -m "v3 tanpa /up" && git push -q origin main
V3="$(git rev-parse HEAD)"
jalankan "deploy v3 gagal karena health check" gagal env DEPLOY_APPROVED_SHA="$V3" "$DEPLOY" run "$V3"
assert_contains "melaporkan langkah gagal" "$KELUARAN" "pemeriksaan kesehatan"
ID3="$(arus_id)"
assert_true "kegagalan tercatat di log" grep -q "deploy GAGAL" "$APP_ROOT/deploy.log"
assert_true "rilis gagal TIDAK tercatat sehat" bash -c "! grep -qx '$ID3' '$APP_ROOT/releases.ok'"
assert_true "kunci dilepas setelah gagal" test ! -d "$APP_ROOT/.deploy.lock"

echo "== rollback"
jalankan "rollback ditolak tanpa persetujuan" gagal "$ROLLBACK" run previous
assert_contains "pesan persetujuan rollback" "$KELUARAN" "belum disetujui"
jalankan "rollback ditolak ke rilis tak dikenal" gagal env ROLLBACK_APPROVED=20200101000000-abcdef1 "$ROLLBACK" run 20200101000000-abcdef1
jalankan "rollback ditolak ke rilis yang gagal health check" gagal env ROLLBACK_APPROVED="$ID3" "$ROLLBACK" run "$ID3"
assert_contains "alasan rilis tak sehat" "$KELUARAN" "lolos pemeriksaan kesehatan"
assert_aktif "$ID3" "rilis aktif tidak berubah setelah penolakan"

jalankan "rollback ke rilis sebelumnya disetujui" 0 env ROLLBACK_APPROVED="$ID2" "$ROLLBACK" run previous
assert_aktif "$ID2" "rilis aktif kembali ke v2"
assert_true "rollback tercatat" grep -q "rollback SUKSES" "$APP_ROOT/deploy.log"
assert_true "health check lulus setelah rollback" curl -fs "$HEALTH_URL/up"
assert_true ".env produksi tetap utuh" diff -q "$TMP/env.asli" "$APP_ROOT/shared/.env"
assert_true "database tidak dipulihkan (migrasi v2 masih ada)" bash -c "sqlite3 '$DB' 'select migration from migrations' | grep -q tambah_kolom"

echo "== rollback ke rilis dengan skema lebih lama"
jalankan "rollback ke v1 ditolak karena skema lebih baru" gagal env ROLLBACK_APPROVED="$ID1" "$ROLLBACK" run "$ID1"
assert_contains "pesan skema lebih baru" "$KELUARAN" "ROLLBACK_APPROVED_SCHEMA_AHEAD=yes"
assert_aktif "$ID2" "rilis aktif tidak berubah"
jalankan "rollback ke v1 dengan persetujuan skema" 0 env ROLLBACK_APPROVED="$ID1" ROLLBACK_APPROVED_SCHEMA_AHEAD=yes "$ROLLBACK" run "$ID1"
assert_aktif "$ID1" "rilis aktif v1"

echo "== migrasi gagal di tengah deploy"
cd "$TMP/work"
touch database/migrations/2026_03_01_000000_gagal.php
git add -A && git commit -q -m "v4 migrasi rusak" && git push -q origin main
V4="$(git rev-parse HEAD)"
SEBELUM_V4="$(arus_id)"
jalankan "deploy v4 gagal saat migrasi" gagal env DEPLOY_APPROVED_SHA="$V4" DEPLOY_APPROVED_MIGRATIONS=yes "$DEPLOY" run "$V4"
assert_contains "melaporkan langkah migrasi" "$KELUARAN" "migrasi database"
assert_contains "memperingatkan mode pemeliharaan" "$KELUARAN" "MODE PEMELIHARAAN"
assert_true "aplikasi dibiarkan dalam mode pemeliharaan" test -e "$APP_ROOT/shared/storage/framework/down"
assert_aktif "$SEBELUM_V4" "rilis aktif tidak berubah"
assert_true "backup ada sebelum migrasi gagal" test "$(find "$BACKUP" -name '*predeploy*' | wc -l | tr -d ' ')" -ge 3
assert_true "rilis gagal tidak tertinggal" bash -c "! ls '$APP_ROOT/releases' | grep -q '${V4:0:7}'"
assert_true "kunci dilepas" test ! -d "$APP_ROOT/.deploy.lock"
rm -f "$APP_ROOT/shared/storage/framework/down"

echo "== deploy bersamaan"
mkdir "$APP_ROOT/.deploy.lock"
echo "deploy-lain" > "$APP_ROOT/.deploy.lock/owner"
jalankan "deploy ditolak saat ada kunci" gagal env DEPLOY_APPROVED_SHA="$V2" DEPLOY_APPROVED_MIGRATIONS=yes "$DEPLOY" run "$V2"
assert_contains "pesan deploy lain" "$KELUARAN" "deploy lain sedang berjalan"
assert_true "kunci milik deploy lain tidak dihapus" test -d "$APP_ROOT/.deploy.lock"
rm -rf "$APP_ROOT/.deploy.lock"

echo "== transport SSH menolak konfigurasi tidak aman"
jalankan "ssh tanpa known_hosts ditolak" gagal env DEPLOY_TRANSPORT=ssh DEPLOY_HOST=192.0.2.1 DEPLOY_SSH_KEY="$TMP/tidak-ada" DEPLOY_KNOWN_HOSTS="$TMP/tidak-ada" "$DEPLOY" plan "$V1"
echo "kunci-palsu" > "$TMP/kunci"
jalankan "ssh sebagai root ditolak" gagal env DEPLOY_TRANSPORT=ssh DEPLOY_HOST=192.0.2.1 DEPLOY_USER=root DEPLOY_SSH_KEY="$TMP/kunci" DEPLOY_KNOWN_HOSTS="$TMP/kunci" "$DEPLOY" plan "$V1"
assert_contains "pesan root" "$KELUARAN" "tidak boleh memakai root"

echo "== akses SSH sementara dan penyiapan server (dry-run)"
export ACCESS_DIR="$TMP/akses"
jalankan "kunci sementara dibuat" 0 "$ASAL/scripts/ssh-access.sh" new
assert_contains "mencetak baris dengan opsi restrict" "$KELUARAN" "restrict ssh-ed25519"
assert_true "kunci privat tidak ikut tercetak" bash -c "! grep -q 'PRIVATE KEY' <<< '$KELUARAN'"
assert_true "kunci privat bermode 600" bash -c "ls -l '$ACCESS_DIR/deploy_key' | cut -c1-10 | grep -qx -- '-rw-------'"
BARIS="$(grep '^restrict ssh-ed25519' <<< "$KELUARAN")"
jalankan "kunci kedua ditolak selama yang pertama belum dicabut" gagal "$ASAL/scripts/ssh-access.sh" new
jalankan "install-key dry-run menerima baris sah" 0 "$ASAL/scripts/server-setup.sh" install-key "$BARIS"
assert_contains "dry-run tidak mengubah apa pun" "$KELUARAN" "DRY-RUN"
jalankan "install-key menolak baris sembarang" gagal "$ASAL/scripts/server-setup.sh" install-key "ssh-ed25519 AAAA bukan-kunci-kita"
jalankan "install-key menolak perintah terselip" gagal "$ASAL/scripts/server-setup.sh" install-key "command=\"rm -rf /\" ssh-ed25519 AAAA deploy-temp-erp-202611071200-abc123"
jalankan "prepare dry-run" 0 env APP_ROOT="$TMP/dry/erp-releases" LEGACY_APP="$TMP/dry/erp" BACKUP_DIR="$TMP/dry/backup" "$ASAL/scripts/server-setup.sh" prepare
assert_contains "sudoers hanya reload php-fpm" "$KELUARAN" "systemctl reload php8.5-fpm"
assert_true "dry-run tidak membuat folder" test ! -e "$TMP/dry"
jalankan "--apply ditolak bila bukan root" gagal "$ASAL/scripts/server-setup.sh" --apply prepare
jalankan "revoke mencabut dan menghapus berkas lokal" 0 env DEPLOY_HOST=127.0.0.1 DEPLOY_PORT=1 "$ASAL/scripts/ssh-access.sh" revoke
assert_true "kunci lokal terhapus" test ! -e "$ACCESS_DIR/deploy_key"
assert_true "kunci publik lokal terhapus" test ! -e "$ACCESS_DIR/deploy_key.pub"
unset ACCESS_DIR

echo "== repositori GitHub diambil dari origin"
parse() { bash -c 'source "$1"; parse_github_repo "$2"' _ "$ASAL/scripts/lib/common.sh" "$1"; }
for pasangan in "https://github.com/org-baru/erp.git|org-baru/erp" "git@github.com:org-baru/erp.git|org-baru/erp" "https://x-access-token:abc@github.com/org-baru/erp|org-baru/erp" "ssh://git@github.com/org-baru/erp.git|org-baru/erp"; do
    HASIL="$(parse "${pasangan%%|*}" 2>/dev/null || true)"
    if [[ "$HASIL" == "${pasangan##*|}" ]]; then ok "parse ${pasangan%%|*}"; else salah "parse ${pasangan%%|*} (dapat: $HASIL)"; fi
done
jalankan "URL non-GitHub ditolak" gagal parse "/tmp/lokal.git"

echo "== keamanan statis"
SKRIP=("$ASAL"/scripts/deploy.sh "$ASAL"/scripts/rollback.sh "$ASAL"/scripts/remote/release.sh "$ASAL"/scripts/lib/common.sh "$ASAL"/scripts/ssh-access.sh "$ASAL"/scripts/server-setup.sh)
if grep -hvE '^\s*#' "${SKRIP[@]}" | grep -nE 'migrate:(fresh|refresh|rollback|reset)|db:wipe|DROP DATABASE|rm -rf /[^a-z]' >/dev/null; then
    salah "skrip memuat perintah destruktif"
else
    ok "tidak ada perintah database destruktif"
fi
if grep -nE 'BEGIN [A-Z ]*PRIVATE KEY|(PASSWORD|SECRET|TOKEN|API_KEY)=[^$"]' "${SKRIP[@]}" >/dev/null; then
    salah "skrip memuat pola rahasia"
else
    ok "tidak ada pola rahasia di skrip"
fi
assert_true "release.sh tidak membuat atau menimpa .env" bash -c "! grep -hvE '^\s*#' '$ASAL/scripts/remote/release.sh' | grep -E '(>|cp|mv|tee).*shared/\.env'"

echo
echo "Lulus: $LULUS, gagal: $GAGAL"
[[ $GAGAL -eq 0 ]]
