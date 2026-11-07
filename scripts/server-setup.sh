#!/usr/bin/env bash
#
# Penyiapan server satu kali untuk deployment rilis berversi. DIJALANKAN SEBAGAI ROOT DI SERVER,
# hanya setelah pemilik menyetujui rencananya. Bawaannya DRY-RUN: hanya mencetak apa yang akan dilakukan.
#
#   scripts/server-setup.sh [--apply] prepare           Folder rilis, folder backup, salin .env (tidak menimpa), sudoers terbatas, cron backup.
#   scripts/server-setup.sh [--apply] install-key "<baris>"  Memasang kunci ke authorized_keys akun deploy (tanpa duplikat).
#   scripts/server-setup.sh [--apply] link-legacy       Membuat current -> aplikasi lama, supaya Nginx bisa dialihkan SEBELUM deploy pertama (tidak mengubah perilaku situs).
#   scripts/server-setup.sh [--apply] switch-nginx      Mengarahkan root Nginx ke current/public (dicadangkan, nginx -t, otomatis dikembalikan bila gagal).
#
# Yang TIDAK dilakukan: menghapus sudo akun deploy yang sudah ada, menyentuh aplikasi lain
# (erp-misjiwati-demo, erp-kayujati, kandang, dst.), mengubah database, atau mematikan login root/sandi.
#
# Variabel (nilai bawaan sesuai audit):
#   APP_ROOT=/var/www/erp-releases   LEGACY_APP=/var/www/erp   DEPLOY_USER=deploy   WEB_GROUP=www-data
#   BACKUP_DIR=/var/backups/erp-misjiwati   PHP_FPM_SERVICE=php8.5-fpm   NGINX_SITE=/etc/nginx/sites-enabled/erp

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/erp-releases}"
LEGACY_APP="${LEGACY_APP:-/var/www/erp}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
WEB_GROUP="${WEB_GROUP:-www-data}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp-misjiwati}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.5-fpm}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-enabled/erp}"
SUDOERS_FILE="${SUDOERS_FILE:-/etc/sudoers.d/erp-deploy}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/erp-misjiwati-backup}"
APPLY=0

log() {
    printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
    log "GAGAL: $*"
    exit 1
}

# act <perintah...>: mencetak, dan menjalankan hanya saat --apply.
act() {
    if [[ $APPLY -eq 1 ]]; then
        log "JALANKAN: $*"
        "$@"
    else
        log "DRY-RUN : $*"
    fi
}

need_root() {
    [[ $APPLY -eq 0 || "$(id -u)" -eq 0 ]] || die "--apply harus dijalankan sebagai root di server"
}

write_file() {
    local tujuan="$1" mode="$2" isi="$3"
    if [[ $APPLY -eq 1 ]]; then
        printf '%s\n' "$isi" > "$tujuan.tmp"
        chmod "$mode" "$tujuan.tmp"
        mv -f "$tujuan.tmp" "$tujuan"
        log "DITULIS : $tujuan"
    else
        log "DRY-RUN : tulis $tujuan (mode $mode):"
        printf '%s\n' "$isi" | sed 's/^/            | /' >&2
    fi
}

cmd_prepare() {
    need_root
    act install -d -o "$DEPLOY_USER" -g "$WEB_GROUP" -m 2775 "$APP_ROOT"
    act install -d -o "$DEPLOY_USER" -g "$WEB_GROUP" -m 2775 "$APP_ROOT/releases" "$APP_ROOT/shared"
    act install -d -o "$DEPLOY_USER" -g "$WEB_GROUP" -m 2775 "$APP_ROOT/shared/storage"
    act install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$BACKUP_DIR"

    if [[ -f "$APP_ROOT/shared/.env" ]]; then
        log ".env bersama sudah ada; tidak ditimpa"
    elif [[ -f "$LEGACY_APP/.env" ]]; then
        act cp -p "$LEGACY_APP/.env" "$APP_ROOT/shared/.env"
        act chown "$DEPLOY_USER:$WEB_GROUP" "$APP_ROOT/shared/.env"
        act chmod 640 "$APP_ROOT/shared/.env"
    elif [[ $APPLY -eq 1 ]]; then
        die "tidak ada .env untuk disalin dari $LEGACY_APP"
    else
        log "DRY-RUN : PERINGATAN: $LEGACY_APP/.env tidak ditemukan; --apply akan berhenti di sini"
    fi

    # Salin storage lama hanya bila baru (tanpa menimpa). Database SQLite TIDAK dipindah:
    # DB_DATABASE di .env tetap menunjuk ke lokasi lamanya.
    if [[ -d "$LEGACY_APP/storage" && -z "$(ls -A "$APP_ROOT/shared/storage" 2>/dev/null || true)" ]]; then
        act cp -a "$LEGACY_APP/storage/." "$APP_ROOT/shared/storage/"
    fi

    local sudoers
    sudoers="$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload $PHP_FPM_SERVICE"
    if [[ $APPLY -eq 1 ]]; then
        printf '%s\n' "$sudoers" > "$SUDOERS_FILE.tmp"
        chmod 440 "$SUDOERS_FILE.tmp"
        visudo -cf "$SUDOERS_FILE.tmp" >/dev/null || { rm -f "$SUDOERS_FILE.tmp"; die "sudoers tidak valid; tidak dipasang"; }
        mv -f "$SUDOERS_FILE.tmp" "$SUDOERS_FILE"
        log "DITULIS : $SUDOERS_FILE (hanya reload $PHP_FPM_SERVICE)"
    else
        log "DRY-RUN : tulis $SUDOERS_FILE: $sudoers"
    fi

    write_file "$CRON_FILE" 644 "# Backup harian database ERP Misjiwati (SQLite), dibuat oleh scripts/server-setup.sh
15 2 * * * $DEPLOY_USER DB_PATH=\$(grep -E '^DB_DATABASE=' $APP_ROOT/shared/.env | cut -d= -f2- | tr -d '\"') BACKUP_DIR=$BACKUP_DIR $APP_ROOT/current/scripts/backup-sqlite.sh >> $BACKUP_DIR/backup.log 2>&1"
    log "Catatan: login SSH root dan sandi tetap terbuka; amankan terpisah setelah akses deploy terbukti bekerja."
}

cmd_install_key() {
    need_root
    local baris="${1:-}"
    [[ "$baris" =~ ^(restrict[[:space:]]+)?ssh-ed25519[[:space:]]+[A-Za-z0-9+/=]+[[:space:]]+deploy-temp-erp-[0-9]{12}-[a-z0-9]{6}$ ]] \
        || die "baris kunci tidak valid; harus 'restrict ssh-ed25519 <kunci> deploy-temp-erp-<tanggal>-<acak>'"
    local dir="/home/$DEPLOY_USER/.ssh" berkas="/home/$DEPLOY_USER/.ssh/authorized_keys"
    act install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$dir"
    if [[ -f "$berkas" ]] && grep -qxF -- "$baris" "$berkas"; then
        log "kunci sudah terpasang"
        return 0
    fi
    if [[ $APPLY -eq 1 ]]; then
        printf '%s\n' "$baris" >> "$berkas"
        chown "$DEPLOY_USER:$DEPLOY_USER" "$berkas"
        chmod 600 "$berkas"
        log "kunci dipasang di $berkas"
    else
        log "DRY-RUN : tambahkan kunci ke $berkas"
    fi
}

cmd_link_legacy() {
    need_root
    [[ -f "$LEGACY_APP/public/index.php" ]] || die "$LEGACY_APP/public/index.php tidak ada; bukan aplikasi Laravel yang valid"
    if [[ -e "$APP_ROOT/current" || -L "$APP_ROOT/current" ]]; then
        log "$APP_ROOT/current sudah ada ($(readlink "$APP_ROOT/current" 2>/dev/null || echo bukan-symlink)); tidak diubah"
        return 0
    fi
    act ln -s "$LEGACY_APP" "$APP_ROOT/current"
    log "Urutan yang benar: link-legacy, switch-nginx (situs tetap sama), baru deploy pertama."
    log "Alasannya: migrasi pada deploy pertama menjalankan mode pemeliharaan dari 'current' dan cek kesehatan harus mengenai rilis baru."
}

cmd_switch_nginx() {
    need_root
    [[ -f "$NGINX_SITE" ]] || die "$NGINX_SITE tidak ada"
    local lama="root $LEGACY_APP/public;" baru="root $APP_ROOT/current/public;"
    grep -qF "$lama" "$NGINX_SITE" || die "baris '$lama' tidak ditemukan di $NGINX_SITE (sudah dialihkan?)"
    [[ -L "$APP_ROOT/current" ]] || die "$APP_ROOT/current belum ada; deploy pertama harus selesai dulu"
    local cadangan
    cadangan="$NGINX_SITE.bak-$(date '+%Y%m%d%H%M%S')"
    act cp -p "$NGINX_SITE" "$cadangan"
    if [[ $APPLY -eq 1 ]]; then
        sed -i "s#$lama#$baru#" "$NGINX_SITE"
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            log "Nginx dialihkan ke $APP_ROOT/current/public. Cadangan: $cadangan"
        else
            cp -p "$cadangan" "$NGINX_SITE"
            die "nginx -t gagal; konfigurasi dikembalikan dari $cadangan"
        fi
    else
        log "DRY-RUN : ganti '$lama' menjadi '$baru' di $NGINX_SITE, nginx -t, reload"
    fi
}

main() {
    if [[ "${1:-}" == "--apply" ]]; then
        APPLY=1
        shift
    fi
    case "${1:-}" in
        prepare) cmd_prepare ;;
        install-key)
            shift
            cmd_install_key "${1:-}"
            ;;
        link-legacy) cmd_link_legacy ;;
        switch-nginx) cmd_switch_nginx ;;
        *)
            sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 2
            ;;
    esac
}

main "$@"
