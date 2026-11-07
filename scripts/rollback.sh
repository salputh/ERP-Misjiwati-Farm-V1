#!/usr/bin/env bash
#
# Rollback KODE ke rilis yang sebelumnya lolos pemeriksaan kesehatan. Dijalankan dari mesin operator.
#
#   scripts/rollback.sh list              Menampilkan rilis di server dan yang aktif.
#   scripts/rollback.sh run <id|previous> Memindahkan symlink ke rilis itu.
#
# Persetujuan pemilik wajib, untuk rilis yang tepat itu:
#   ROLLBACK_APPROVED=<id rilis target>
#
# Yang TIDAK dilakukan skrip ini, dengan sengaja:
#   - tidak membalik migrasi (tidak ada migrate:rollback/reset/fresh);
#   - tidak memulihkan database dari backup;
#   - tidak menimpa .env atau storage produksi (keduanya bersama di shared/).
#
# Bila database sudah memuat migrasi yang tidak ada di rilis target, kode lama akan berjalan di atas
# skema yang lebih baru. Skrip berhenti dan meminta persetujuan terpisah:
#   ROLLBACK_APPROVED_SCHEMA_AHEAD=yes   (menerima risiko menjalankan kode lama di skema baru)
# Pemulihan database dari backup bukan bagian skrip ini: lihat docs/deployment/rollback-guide.md.

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

usage() {
    sed -n '3,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 2
}

cmd_list() {
    validate_transport
    remote status
}

cmd_run() {
    local diminta="$1" ahead id_sekarang
    diminta_global="$diminta"
    # Status ini sengaja global: handler EXIT berjalan setelah fungsi ini selesai.
    target="" token="" langkah="persiapan"
    validate_transport
    require_env HEALTH_URL

    remote init
    token="rollback-$$-$(date '+%s')"
    remote lock "$token"

    # shellcheck disable=SC2329 # dipanggil lewat trap
    selesai() {
        local kode=$?
        if [[ $kode -ne 0 ]]; then
            log "ROLLBACK GAGAL pada langkah: $langkah"
            remote record "rollback GAGAL target=${target:-$diminta_global} langkah=$langkah" || true
        fi
        remote unlock "$token" || true
        exit "$kode"
    }
    trap selesai EXIT

    langkah="validasi target"
    target="$(remote rollback-target "$diminta")"
    [[ "${ROLLBACK_APPROVED:-}" == "$target" ]] \
        || die "belum disetujui. Isi ROLLBACK_APPROVED=$target (persetujuan sebelumnya tidak berlaku untuk target lain)"

    id_sekarang="$(remote status | grep '^current=' | cut -d= -f2-)"
    [[ "$id_sekarang" != "$target" ]] || die "rilis $target sudah aktif; tidak ada yang perlu dilakukan"

    langkah="pemeriksaan skema"
    ahead="$(remote schema-ahead "$target")"
    if [[ -n "$ahead" ]]; then
        log "Database memuat migrasi yang tidak ada di rilis $target:"
        printf '%s\n' "$ahead" | sed 's/^/    /' >&2
        [[ "${ROLLBACK_APPROVED_SCHEMA_AHEAD:-}" == "yes" ]] \
            || die "kode lama di atas skema yang lebih baru bisa error. Menurut kebijakan, skrip berhenti: butuh persetujuan eksplisit (ROLLBACK_APPROVED_SCHEMA_AHEAD=yes), atau pemulihan database dari backup lewat prosedur terpisah. Tidak ada yang diubah."
    fi

    langkah="aktivasi rilis lama"
    remote record "rollback MULAI dari=$id_sekarang ke=$target oleh=$(id -un)"
    remote activate "$target"

    langkah="pemeriksaan kesehatan"
    remote health
    remote record "rollback SUKSES dari=$id_sekarang ke=$target"
    log "SELESAI. Rilis aktif: $target. Rilis yang dicabut ($id_sekarang) tetap ada di server."
}

main() {
    local perintah="${1:-}"
    case "$perintah" in
        list) cmd_list ;;
        run)
            [[ -n "${2:-}" ]] || usage
            cmd_run "$2"
            ;;
        *) usage ;;
    esac
}

main "$@"
