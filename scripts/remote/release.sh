#!/usr/bin/env bash
#
# Sisi server untuk deployment rilis berversi. Tidak dijalankan langsung oleh manusia:
# scripts/deploy.sh dan scripts/rollback.sh mengirimnya lewat SSH ("bash -s -- <subperintah>").
#
# Tata letak di $APP_ROOT:
#   releases/<id>/    kode tiap rilis (tidak diubah setelah dibuat)
#   shared/.env       konfigurasi produksi, TIDAK PERNAH dibuat atau ditimpa oleh skrip ini
#   shared/storage/   log, cache, sesi
#   current           symlink ke rilis aktif
#   previous          id rilis aktif sebelum yang sekarang
#   releases.ok       id rilis yang lolos pemeriksaan kesehatan
#   deploy.log        catatan deploy dan rollback
#   .deploy.lock/     kunci agar tidak ada dua deploy bersamaan
#
# Hanya SQLite yang didukung. Skrip ini tidak pernah menjalankan migrate:fresh, migrate:refresh,
# migrate:rollback, migrate:reset, db:wipe, atau memulihkan database.

set -euo pipefail

APP_ROOT="${APP_ROOT:?APP_ROOT belum diisi}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
PHP_BIN="${PHP_BIN:-php}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp-misjiwati}"
QUEUE_WORKERS="${QUEUE_WORKERS:-no}"
COMPOSER_CMD="${COMPOSER_CMD:-composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --no-progress}"
HEALTH_URL="${HEALTH_URL:-}"
HEALTH_PATHS="${HEALTH_PATHS:-/up}"
HEALTH_RETRIES="${HEALTH_RETRIES:-5}"
HEALTH_DELAY="${HEALTH_DELAY:-2}"

RELEASES="$APP_ROOT/releases"
SHARED="$APP_ROOT/shared"
CURRENT="$APP_ROOT/current"
PREVIOUS_FILE="$APP_ROOT/previous"
OK_FILE="$APP_ROOT/releases.ok"
LOG_FILE="$APP_ROOT/deploy.log"
LOCK_DIR="$APP_ROOT/.deploy.lock"

log() {
    printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
    log "GAGAL: $*"
    exit 1
}

valid_id() {
    [[ "$1" =~ ^[0-9]{14}-[0-9a-f]{7,40}$ ]] || die "id rilis tidak valid: $1"
}

release_dir() {
    valid_id "$1"
    echo "$RELEASES/$1"
}

current_id() {
    if [[ -L "$CURRENT" ]]; then
        basename "$(readlink "$CURRENT")"
    fi
}

# Nilai DB_DATABASE dari .env bersama. Hanya variabel ini dan DB_CONNECTION yang dibaca.
env_value() {
    grep -E "^$1=" "$SHARED/.env" | head -n 1 | cut -d= -f2- | tr -d '"' || true
}

db_path() {
    [[ -f "$SHARED/.env" ]] || die "$SHARED/.env tidak ada"
    [[ "$(env_value DB_CONNECTION)" == "sqlite" ]] || die "hanya DB_CONNECTION=sqlite yang didukung skrip ini"
    local path
    path="$(env_value DB_DATABASE)"
    [[ -n "$path" ]] || die "DB_DATABASE belum diisi di shared/.env"
    echo "$path"
}

record() {
    printf '%s\t%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$LOG_FILE"
}

atomic_symlink() {
    local target="$1" link="$2"
    if mv --version >/dev/null 2>&1; then
        ln -sfn "$target" "$link.tmp"
        mv -Tf "$link.tmp" "$link"
    else
        # BSD/macOS tidak punya mv -T: hanya untuk pengujian lokal, tidak atomik.
        ln -sfn "$target" "$link"
    fi
}

cmd_init() {
    [[ -f "$SHARED/.env" ]] || die "$SHARED/.env belum ada. Salin .env produksi ke sana lebih dulu; skrip tidak pernah membuat atau menimpanya."
    mkdir -p "$RELEASES" "$SHARED/storage/app/public" "$SHARED/storage/framework/cache/data" \
        "$SHARED/storage/framework/sessions" "$SHARED/storage/framework/views" "$SHARED/storage/logs"
    touch "$LOG_FILE" "$OK_FILE"
}

cmd_status() {
    local sekarang sebelumnya terakhir
    sekarang="$(current_id)"
    sebelumnya=""
    [[ -f "$PREVIOUS_FILE" ]] && sebelumnya="$(cat "$PREVIOUS_FILE")"
    echo "current=${sekarang:-}"
    echo "current_sha=$(cat "$CURRENT/REVISION" 2>/dev/null || true)"
    echo "previous=$sebelumnya"
    terakhir=""
    if [[ -d "$BACKUP_DIR" ]]; then
        terakhir="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.sqlite.gz' -type f -exec ls -t {} + 2>/dev/null | head -n 1 || true)"
    fi
    if [[ -n "$terakhir" ]]; then
        echo "last_backup=$(basename "$terakhir")"
    else
        echo "last_backup="
    fi
    echo "releases=$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort | tr '\n' ' ')"
}

cmd_lock() {
    local token="${1:?token kunci wajib}"
    mkdir -p "$APP_ROOT"
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        die "deploy lain sedang berjalan (kunci: $(cat "$LOCK_DIR/owner" 2>/dev/null || echo tidak-diketahui)). Jika yakin sudah mati, jalankan 'unlock-force' secara manual."
    fi
    echo "$token" > "$LOCK_DIR/owner"
}

cmd_unlock() {
    local token="${1:?token kunci wajib}"
    if [[ -d "$LOCK_DIR" && "$(cat "$LOCK_DIR/owner" 2>/dev/null)" == "$token" ]]; then
        rm -rf "$LOCK_DIR"
    fi
}

cmd_unlock_force() {
    rm -rf "$LOCK_DIR"
    log "kunci dilepas paksa"
}

cmd_prepare() {
    local id="$1" tarball="$2" checksum="$3" sha="$4" dir
    dir="$(release_dir "$id")"
    [[ ! -e "$dir" ]] || die "rilis $id sudah ada"
    [[ -f "$tarball" ]] || die "arsip tidak ditemukan: $tarball"

    local hitung
    if command -v sha256sum >/dev/null 2>&1; then
        hitung="$(sha256sum "$tarball" | cut -d' ' -f1)"
    else
        hitung="$(shasum -a 256 "$tarball" | cut -d' ' -f1)"
    fi
    [[ "$hitung" == "$checksum" ]] || die "checksum arsip tidak cocok"

    mkdir -p "$dir"
    # Bila langkah berikutnya gagal, rilis setengah jadi dibuang; rilis aktif tidak tersentuh.
    if ! ( tar -xzf "$tarball" -C "$dir" \
        && rm -rf "$dir/storage" "$dir/.env" \
        && ln -s "$SHARED/storage" "$dir/storage" \
        && ln -s "$SHARED/.env" "$dir/.env" \
        && mkdir -p "$dir/bootstrap/cache" \
        && echo "$sha" > "$dir/REVISION" \
        && cd "$dir" && bash -c "$COMPOSER_CMD" ); then
        rm -rf "$dir"
        die "persiapan rilis $id gagal; rilis dibuang"
    fi
    rm -f "$tarball"
    log "rilis $id siap"
}

cmd_backup() {
    local id="$1" db tujuan sementara
    db="$(db_path)"
    [[ -f "$db" ]] || die "database tidak ditemukan: $db"
    command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 belum terpasang"

    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    tujuan="$BACKUP_DIR/database-predeploy-$id.sqlite"
    sementara="$tujuan.tmp"
    rm -f "$sementara"

    sqlite3 "$db" ".backup '$sementara'"
    [[ "$(sqlite3 "$sementara" 'PRAGMA integrity_check;')" == "ok" ]] || { rm -f "$sementara"; die "integrity_check backup gagal"; }
    mv "$sementara" "$tujuan"
    gzip -f "$tujuan"
    gzip -t "$tujuan.gz" || die "arsip backup rusak"
    chmod 600 "$tujuan.gz"
    echo "backup=$tujuan.gz"
}

# Migrasi yang ada di berkas rilis tetapi belum tercatat di tabel migrations.
cmd_pending() {
    local id="$1" dir db berkas nama
    dir="$(release_dir "$id")"
    db="$(db_path)"
    local sudah=""
    if [[ -f "$db" ]] && [[ "$(sqlite3 "$db" "SELECT count(*) FROM sqlite_master WHERE name='migrations';")" == "1" ]]; then
        sudah="$(sqlite3 "$db" 'SELECT migration FROM migrations;')"
    fi
    for berkas in "$dir"/database/migrations/*.php; do
        [[ -e "$berkas" ]] || continue
        nama="$(basename "$berkas" .php)"
        if ! grep -qxF "$nama" <<< "$sudah"; then
            echo "$nama"
        fi
    done
}

cmd_migrate() {
    local id="$1" setuju="${2:-}"
    [[ "$setuju" == "--approved" ]] || die "migrasi database butuh persetujuan eksplisit (--approved)"
    (cd "$(release_dir "$id")" && "$PHP_BIN" artisan migrate --force --no-interaction)
}

cmd_down() {
    [[ -L "$CURRENT" ]] || return 0
    (cd "$CURRENT" && "$PHP_BIN" artisan down --retry=30 --no-interaction)
}

cmd_up() {
    local id="$1"
    (cd "$(release_dir "$id")" && "$PHP_BIN" artisan up --no-interaction)
}

cmd_optimize() {
    local id="$1"
    (cd "$(release_dir "$id")" && "$PHP_BIN" artisan optimize --no-interaction)
}

reload_services() {
    local id="$1"
    if [[ -n "$PHP_FPM_SERVICE" ]]; then
        sudo -n systemctl reload "$PHP_FPM_SERVICE" || die "reload $PHP_FPM_SERVICE gagal"
    fi
    if [[ "$QUEUE_WORKERS" == "yes" ]]; then
        (cd "$(release_dir "$id")" && "$PHP_BIN" artisan queue:restart --no-interaction)
    fi
}

cmd_activate() {
    local id="$1" dir lama
    dir="$(release_dir "$id")"
    [[ -d "$dir" ]] || die "rilis $id tidak ada"
    lama="$(current_id)"
    atomic_symlink "releases/$id" "$CURRENT"
    # Aplikasi lama (current -> /var/www/erp sebelum rilis pertama) bukan rilis berversi:
    # kembali ke sana dilakukan dengan mengembalikan root Nginx, bukan lewat rollback.sh.
    if [[ -n "$lama" && "$lama" != "$id" && "$lama" =~ ^[0-9]{14}-[0-9a-f]{7,40}$ ]]; then
        echo "$lama" > "$PREVIOUS_FILE"
    fi
    reload_services "$id"
    log "rilis aktif: $id (sebelumnya: ${lama:-tidak ada})"
}

cmd_health() {
    local path kode percobaan
    [[ -n "$HEALTH_URL" ]] || die "HEALTH_URL belum diisi"
    for path in $HEALTH_PATHS; do
        kode=""
        for ((percobaan = 1; percobaan <= HEALTH_RETRIES; percobaan++)); do
            kode="$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' "$HEALTH_URL$path" || true)"
            [[ "$kode" == "200" ]] && break
            [[ "$percobaan" -lt "$HEALTH_RETRIES" ]] && sleep "$HEALTH_DELAY"
        done
        if [[ "$kode" != "200" ]]; then
            log "kesehatan $path: HTTP ${kode:-tanpa-respons}"
            return 1
        fi
        log "kesehatan $path: 200"
    done
}

# Membuang rilis yang disiapkan tetapi tidak pernah diaktifkan. Rilis aktif tidak pernah dibuang.
cmd_discard() {
    local id="$1" dir
    dir="$(release_dir "$id")"
    [[ "$(current_id)" != "$id" ]] || die "rilis $id sedang aktif; tidak dibuang"
    rm -rf "$dir"
}

cmd_mark_ok() {
    local id="$1"
    valid_id "$id"
    grep -qxF "$id" "$OK_FILE" 2>/dev/null || echo "$id" >> "$OK_FILE"
}

cmd_record() {
    record "$*"
}

cmd_cleanup() {
    local sekarang sebelumnya id jumlah=0
    sekarang="$(current_id)"
    sebelumnya=""
    [[ -f "$PREVIOUS_FILE" ]] && sebelumnya="$(cat "$PREVIOUS_FILE")"
    while IFS= read -r id; do
        jumlah=$((jumlah + 1))
        if [[ "$jumlah" -gt "$KEEP_RELEASES" && "$id" != "$sekarang" && "$id" != "$sebelumnya" ]]; then
            rm -rf "${RELEASES:?}/$id"
            log "rilis lama dihapus: $id"
        fi
    done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort -r)
}

# Migrasi yang sudah ada di database tetapi tidak ada di berkas rilis target: kode lama
# akan berjalan di atas skema yang lebih baru.
cmd_schema_ahead() {
    local id="$1" dir db nama
    dir="$(release_dir "$id")"
    db="$(db_path)"
    [[ -f "$db" ]] || return 0
    while IFS= read -r nama; do
        [[ -n "$nama" ]] || continue
        [[ -e "$dir/database/migrations/$nama.php" ]] || echo "$nama"
    done < <(sqlite3 "$db" "SELECT migration FROM migrations;" 2>/dev/null || true)
}

cmd_rollback_target() {
    local target="$1"
    if [[ "$target" == "previous" ]]; then
        [[ -f "$PREVIOUS_FILE" ]] || die "tidak ada catatan rilis sebelumnya"
        target="$(cat "$PREVIOUS_FILE")"
    fi
    valid_id "$target"
    [[ -d "$RELEASES/$target" ]] || die "rilis $target tidak ada di server"
    grep -qxF "$target" "$OK_FILE" || die "rilis $target tidak tercatat lolos pemeriksaan kesehatan; rollback hanya ke rilis yang diketahui baik"
    echo "$target"
}

main() {
    local perintah="${1:-}"
    [[ -n "$perintah" ]] || die "subperintah wajib"
    shift
    case "$perintah" in
        init) cmd_init ;;
        status) cmd_status ;;
        lock) cmd_lock "$@" ;;
        unlock) cmd_unlock "$@" ;;
        unlock-force) cmd_unlock_force ;;
        prepare) cmd_prepare "$@" ;;
        backup) cmd_backup "$@" ;;
        pending) cmd_pending "$@" ;;
        migrate) cmd_migrate "$@" ;;
        down) cmd_down ;;
        up) cmd_up "$@" ;;
        optimize) cmd_optimize "$@" ;;
        activate) cmd_activate "$@" ;;
        health) cmd_health ;;
        discard) cmd_discard "$@" ;;
        mark-ok) cmd_mark_ok "$@" ;;
        record) cmd_record "$@" ;;
        cleanup) cmd_cleanup ;;
        schema-ahead) cmd_schema_ahead "$@" ;;
        rollback-target) cmd_rollback_target "$@" ;;
        *) die "subperintah tidak dikenal: $perintah" ;;
    esac
}

main "$@" < /dev/null
