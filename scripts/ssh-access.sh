#!/usr/bin/env bash
#
# Mengelola akses SSH sementara untuk akun deploy. Dijalankan dari mesin operator.
#
#   scripts/ssh-access.sh new            Membuat kunci sementara dan mencetak baris authorized_keys-nya.
#   scripts/ssh-access.sh pin            Mengambil kunci host server ke known_hosts dan mencetak sidik jarinya.
#   scripts/ssh-access.sh revoke         Mencabut kunci di server, memverifikasi ditolak, lalu menghapus berkas lokal.
#   scripts/ssh-access.sh verify-revoked Memeriksa bahwa kunci sudah tidak bisa dipakai.
#
# Variabel:
#   DEPLOY_HOST     alamat server                       (wajib)
#   DEPLOY_USER     akun deploy                         (deploy)
#   DEPLOY_PORT     port SSH                            (22)
#   ACCESS_DIR      folder kunci sementara              (~/.cache/erp-deploy-access, mode 700)
#
# Aturan: kunci dibuat per sesi, tidak pernah disimpan di repositori, tidak pernah dicetak bagian
# privatnya, dan dicabut dari server lalu dihapus dari mesin ini setelah selesai. Pemasangan baris
# kunci ke server dilakukan oleh pemilik (atau sesi root yang disetujui) lewat
# `scripts/server-setup.sh install-key`; skrip ini tidak punya akses root.
# Akses API/MCP Hostinger adalah hal terpisah: menghapus kunci SSH TIDAK mencabutnya.

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

ACCESS_DIR="${ACCESS_DIR:-$HOME/.cache/erp-deploy-access}"
KEY_FILE="$ACCESS_DIR/deploy_key"
KNOWN_HOSTS_FILE="$ACCESS_DIR/known_hosts"
COMMENT_FILE="$ACCESS_DIR/comment"

usage() {
    sed -n '3,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 2
}

prepare_dir() {
    mkdir -p "$ACCESS_DIR"
    chmod 700 "$ACCESS_DIR"
}

cmd_new() {
    prepare_dir
    [[ ! -e "$KEY_FILE" ]] || die "sudah ada kunci sementara di $ACCESS_DIR. Cabut dulu dengan 'revoke'"
    local komentar
    komentar="deploy-temp-erp-$(date '+%Y%m%d%H%M')-$(openssl rand -hex 3)"
    ssh-keygen -q -t ed25519 -N "" -C "$komentar" -f "$KEY_FILE"
    echo "$komentar" > "$COMMENT_FILE"
    chmod 600 "$KEY_FILE" "$COMMENT_FILE"
    log "Kunci sementara dibuat. Kunci privat: $KEY_FILE (jangan dibagikan)."
    log "Pasang baris berikut ke server (sebagai root, lewat 'server-setup.sh install-key'):"
    printf 'restrict %s\n' "$(cat "$KEY_FILE.pub")"
}

cmd_pin() {
    require_env DEPLOY_HOST
    prepare_dir
    ssh-keyscan -p "$DEPLOY_PORT" -t ed25519 -T 10 "$DEPLOY_HOST" > "$KNOWN_HOSTS_FILE" 2>/dev/null
    [[ -s "$KNOWN_HOSTS_FILE" ]] || die "tidak bisa mengambil kunci host dari $DEPLOY_HOST"
    chmod 600 "$KNOWN_HOSTS_FILE"
    log "Sidik jari host (bandingkan dengan yang ditampilkan hPanel atau konsol server sebelum percaya):"
    ssh-keygen -lf "$KNOWN_HOSTS_FILE"
}

login_works() {
    ssh -i "$KEY_FILE" -p "$DEPLOY_PORT" \
        -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o PasswordAuthentication=no \
        -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes \
        "$DEPLOY_USER@$DEPLOY_HOST" true >/dev/null 2>&1
}

cmd_verify_revoked() {
    require_env DEPLOY_HOST
    [[ -f "$KEY_FILE" ]] || die "tidak ada kunci lokal untuk diuji"
    if login_works; then
        die "kunci MASIH bisa dipakai untuk login"
    fi
    log "Terverifikasi: login dengan kunci sementara ditolak."
}

cmd_revoke() {
    require_env DEPLOY_HOST
    [[ -f "$KEY_FILE" && -f "$COMMENT_FILE" ]] || die "tidak ada kunci sementara di $ACCESS_DIR"
    [[ "$DEPLOY_USER" != "root" ]] || die "akun deploy tidak boleh root"
    local komentar
    komentar="$(cat "$COMMENT_FILE")"
    [[ "$komentar" =~ ^deploy-temp-erp-[0-9]{12}-[a-z0-9]{6}$ ]] || die "komentar kunci tidak valid"

    # Hanya baris dengan komentar unik kunci ini yang dihapus; baris lain tidak disentuh.
    if login_works; then
        log "Menghapus baris '$komentar' dari authorized_keys di server"
        ssh -i "$KEY_FILE" -p "$DEPLOY_PORT" -o IdentitiesOnly=yes -o BatchMode=yes \
            -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes \
            "$DEPLOY_USER@$DEPLOY_HOST" \
            "f=\$HOME/.ssh/authorized_keys; grep -vF -- '$komentar' \"\$f\" > \"\$f.new\" || true; chmod 600 \"\$f.new\"; mv -f \"\$f.new\" \"\$f\""
    else
        log "Kunci sudah tidak bisa login (mungkin sudah dicabut). Lanjut verifikasi dan pembersihan lokal."
    fi

    cmd_verify_revoked
    rm -f "$KEY_FILE" "$KEY_FILE.pub" "$COMMENT_FILE"
    log "Berkas kunci lokal dihapus. Akses token API/MCP Hostinger tidak terpengaruh dan perlu dicabut terpisah bila dipakai."
}

main() {
    case "${1:-}" in
        new) cmd_new ;;
        pin) cmd_pin ;;
        revoke) cmd_revoke ;;
        verify-revoked) cmd_verify_revoked ;;
        *) usage ;;
    esac
}

main "$@"
