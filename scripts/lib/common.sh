#!/usr/bin/env bash
#
# Fungsi bersama untuk scripts/deploy.sh dan scripts/rollback.sh (sisi operator).
# File ini hanya di-source, tidak dijalankan langsung.
#
# Konfigurasi lewat variabel lingkungan. Tidak ada rahasia di sini dan tidak ada yang dicetak ke log.
#   DEPLOY_TRANSPORT   ssh (bawaan) atau local (hanya untuk pengujian di mesin ini)
#   DEPLOY_HOST        alamat server                     (wajib untuk ssh)
#   DEPLOY_USER        akun deploy                       (deploy)
#   DEPLOY_PORT        port SSH                          (22)
#   DEPLOY_SSH_KEY     kunci privat sementara            (wajib untuk ssh)
#   DEPLOY_KNOWN_HOSTS berkas known_hosts yang dipin     (wajib untuk ssh)
#   APP_ROOT           akar rilis di server              (/var/www/erp-releases)
#   HEALTH_URL         alamat dasar untuk cek kesehatan  (wajib)
#   HEALTH_PATHS       path yang dicek                   (/up)
#   PHP_FPM_SERVICE    layanan yang di-reload            (php8.5-fpm; kosong = tidak di-reload)
#   BACKUP_DIR         folder backup di server           (/var/backups/erp-misjiwati)
#   KEEP_RELEASES      jumlah rilis disimpan             (5)
#   GITHUB_REPO        owner/nama untuk cek CI           (salputh/ERP-Misjiwati-Farm-V1)
#   CI_CHECK_NAME      nama check gerbang CI             (CI lulus)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_SCRIPT="$SCRIPT_DIR/remote/release.sh"

DEPLOY_TRANSPORT="${DEPLOY_TRANSPORT:-ssh}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
APP_ROOT="${APP_ROOT:-/var/www/erp-releases}"
HEALTH_PATHS="${HEALTH_PATHS:-/up}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE-php8.5-fpm}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp-misjiwati}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
GITHUB_REPO="${GITHUB_REPO:-salputh/ERP-Misjiwati-Farm-V1}"
CI_CHECK_NAME="${CI_CHECK_NAME:-CI lulus}"

log() {
    printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
    log "GAGAL: $*"
    exit 1
}

require_env() {
    local nama
    for nama in "$@"; do
        [[ -n "${!nama-}" ]] || die "variabel $nama belum diisi"
    done
}

require_commands() {
    local perintah
    for perintah in "$@"; do
        command -v "$perintah" >/dev/null 2>&1 || die "perintah '$perintah' tidak ditemukan"
    done
}

# Pemeriksaan umum sebelum menghubungi server.
validate_transport() {
    case "$DEPLOY_TRANSPORT" in
        local)
            :
            ;;
        ssh)
            require_env DEPLOY_HOST DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
            [[ -f "$DEPLOY_SSH_KEY" ]] || die "kunci SSH tidak ditemukan: $DEPLOY_SSH_KEY"
            [[ -f "$DEPLOY_KNOWN_HOSTS" ]] || die "known_hosts tidak ditemukan: $DEPLOY_KNOWN_HOSTS (identitas server wajib dipin)"
            [[ "$DEPLOY_USER" != "root" ]] || die "deploy tidak boleh memakai root"
            ;;
        *)
            die "DEPLOY_TRANSPORT harus ssh atau local"
            ;;
    esac
}

ssh_options() {
    SSH_OPTIONS=(
        -i "$DEPLOY_SSH_KEY"
        -p "$DEPLOY_PORT"
        -o IdentitiesOnly=yes
        -o BatchMode=yes
        -o ConnectTimeout=15
        -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS"
        -o StrictHostKeyChecking=yes
    )
}

# Variabel yang diteruskan ke skrip server. Nilai dikutip aman untuk shell jarak jauh.
FORWARDED_VARS=(APP_ROOT KEEP_RELEASES PHP_FPM_SERVICE BACKUP_DIR QUEUE_WORKERS COMPOSER_CMD PHP_BIN HEALTH_URL HEALTH_PATHS HEALTH_RETRIES HEALTH_DELAY)

# remote <subperintah> [argumen...]: menjalankan scripts/remote/release.sh di server.
remote() {
    local nama
    local -a mentah=()
    local terkutip=""

    for nama in "${FORWARDED_VARS[@]}"; do
        if [[ -n "${!nama+x}" ]]; then
            mentah+=("$nama=${!nama}")
            terkutip+="$(printf '%s=%q ' "$nama" "${!nama}")"
        fi
    done

    if [[ "$DEPLOY_TRANSPORT" == "local" ]]; then
        env "${mentah[@]}" bash -s -- "$@" < "$REMOTE_SCRIPT"
        return
    fi

    ssh_options
    local argumen=""
    [[ $# -gt 0 ]] && argumen="$(printf '%q ' "$@")"
    # Perintah jarak jauh disusun di sisi klien dengan sengaja; semua nilai sudah dikutip dengan %q.
    # shellcheck disable=SC2029,SC2153
    ssh "${SSH_OPTIONS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "env ${terkutip}bash -s -- ${argumen}" < "$REMOTE_SCRIPT"
}

# push_file <berkas lokal> <tujuan di server>
push_file() {
    if [[ "$DEPLOY_TRANSPORT" == "local" ]]; then
        cp "$1" "$2"
        return
    fi

    ssh_options
    local -a opsi_scp=("${SSH_OPTIONS[@]}")
    # scp memakai -P untuk port, bukan -p.
    local i
    for i in "${!opsi_scp[@]}"; do
        if [[ "${opsi_scp[$i]}" == "-p" ]]; then
            opsi_scp[i]="-P"
        fi
    done
    scp -q "${opsi_scp[@]}" "$1" "$DEPLOY_USER@$DEPLOY_HOST:$2"
}

# Status CI untuk sebuah commit: success, failure, pending, atau tidak-ada.
# Memakai check "gerbang" (CI_CHECK_NAME) dari GitHub Actions. Tidak ada cara melewatinya
# kecuali transport local (pengujian), yang boleh menyediakan DEPLOY_CI_STATUS_CMD.
ci_status() {
    local sha="$1" hasil

    if [[ "$DEPLOY_TRANSPORT" == "local" && -n "${DEPLOY_CI_STATUS_CMD:-}" ]]; then
        "$DEPLOY_CI_STATUS_CMD" "$sha"
        return
    fi

    require_commands gh jq
    hasil="$(gh api "repos/$GITHUB_REPO/commits/$sha/check-runs?per_page=100" \
        --jq "[.check_runs[] | select(.name == \"$CI_CHECK_NAME\")] | sort_by(.started_at) | last | (.conclusion // .status // \"tidak-ada\")" 2>/dev/null || true)"

    case "$hasil" in
        success) echo success ;;
        "" | null) echo tidak-ada ;;
        queued | in_progress) echo pending ;;
        *) echo failure ;;
    esac
}

# Menetapkan SHA penuh dari argumen; menolak yang tidak ada.
resolve_commit() {
    local ref="$1" sha
    sha="$(git -C "$REPO_ROOT" rev-parse --verify --quiet "${ref}^{commit}")" || die "commit '$ref' tidak ditemukan"
    echo "$sha"
}
