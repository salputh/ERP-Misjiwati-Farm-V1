#!/usr/bin/env bash
#
# Deploy rilis berversi untuk ERP Misjiwati Farm. Dijalankan dari mesin operator, bukan dari server.
#
#   scripts/deploy.sh plan <commit>   Menampilkan DEPLOYMENT PLAN. Hanya membaca, tidak mengubah apa pun.
#   scripts/deploy.sh run  <commit>   Menjalankan deploy. Butuh persetujuan pemilik (lihat di bawah).
#
# Skrip ini TIDAK menyetujui deploy sendiri. Pemilik menyetujui dengan mengisi variabel berikut
# setelah membaca rencananya, untuk commit yang tepat itu:
#   DEPLOY_APPROVED_SHA=<sha penuh 40 karakter>
#   DEPLOY_APPROVED_MIGRATIONS=yes        hanya bila rencana memuat migrasi baru
#
# Yang dijamin: hanya commit yang sudah ada di origin/main dan lulus CI; tidak ada perubahan lokal
# yang ikut; .env dan storage produksi dipertahankan; tidak ada perintah database destruktif;
# deploy bersamaan ditolak; kegagalan menghentikan proses dan melaporkan langkahnya.
# Konfigurasi variabel lingkungan: lihat scripts/lib/common.sh.

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

BRANCH_SUMBER="${DEPLOY_SOURCE_BRANCH:-main}"
RISKY_PATTERN='dropColumn|dropIfExists|->drop\(|truncate|renameColumn|rename\(|DB::statement|DB::unprepared|->change\('

indent() {
    sed 's/^/  /'
}

usage() {
    sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 2
}

# Commit sudah ada di origin/<branch sumber>, dan pohon kerja bersih.
verify_commit() {
    local sha="$1"
    if [[ "$DEPLOY_TRANSPORT" != "local" ]]; then
        git -C "$REPO_ROOT" fetch --quiet origin
    fi
    git -C "$REPO_ROOT" merge-base --is-ancestor "$sha" "origin/$BRANCH_SUMBER" \
        || die "commit $sha tidak ada di origin/$BRANCH_SUMBER. Hanya commit yang sudah digabung dan di-push yang boleh di-deploy"
    [[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]] \
        || die "ada perubahan lokal yang belum di-commit; commit atau simpan dulu (deploy tidak pernah membawa perubahan lokal)"
}

migrations_changed() {
    local dari="$1" ke="$2"
    if [[ -n "$dari" ]] && git -C "$REPO_ROOT" cat-file -e "$dari^{commit}" 2>/dev/null; then
        git -C "$REPO_ROOT" diff --name-only --diff-filter=AMR "$dari" "$ke" -- database/migrations
    else
        git -C "$REPO_ROOT" ls-tree -r --name-only "$ke" -- database/migrations
    fi
}

cmd_plan() {
    local sha="$1" status prod_sha ci migrasi riskan backup
    validate_transport
    status="$(remote status)" || die "tidak bisa membaca status server"
    prod_sha="$(grep '^current_sha=' <<< "$status" | cut -d= -f2-)"
    backup="$(grep '^last_backup=' <<< "$status" | cut -d= -f2-)"
    ci="$(ci_status "$sha")"
    migrasi="$(migrations_changed "$prod_sha" "$sha" || true)"

    echo "DEPLOYMENT PLAN"
    echo "==============="
    echo "Commit produksi sekarang : ${prod_sha:-tidak diketahui (belum ada rilis berversi)}"
    echo "Commit target            : $sha"
    echo "Pesan commit             : $(git -C "$REPO_ROOT" log -1 --format=%s "$sha")"
    echo
    echo "Perubahan yang akan di-deploy:"
    if [[ -n "$prod_sha" ]] && git -C "$REPO_ROOT" cat-file -e "$prod_sha^{commit}" 2>/dev/null; then
        git -C "$REPO_ROOT" log --oneline "$prod_sha..$sha" | sed 's/^/  /'
        git -C "$REPO_ROOT" diff --shortstat "$prod_sha" "$sha" | sed 's/^/  /'
    else
        echo "  (commit produksi tidak dikenal di repositori lokal; menampilkan 10 commit terakhir)"
        git -C "$REPO_ROOT" log --oneline -10 "$sha" | sed 's/^/  /'
    fi
    echo
    echo "Verifikasi CI ($CI_CHECK_NAME): $ci"
    echo
    echo "Perubahan migrasi database:"
    if [[ -z "$migrasi" ]]; then
        echo "  tidak ada migrasi baru"
    else
        printf '%s\n' "$migrasi" | indent
        riskan="$(for berkas in $migrasi; do
            git -C "$REPO_ROOT" show "$sha:$berkas" 2>/dev/null | grep -nE "$RISKY_PATTERN" | sed "s|^|    $berkas:|" || true
        done)"
        if [[ -n "$riskan" ]]; then
            echo "  Operasi berisiko terdeteksi (tinjau manual sebelum menyetujui):"
            echo "$riskan"
        fi
    fi
    echo
    echo "Backup database terakhir di server: ${backup:-tidak ada}"
    echo "  Backup baru dibuat dan diverifikasi (integrity_check) tepat sebelum deploy."
    echo
    echo "Risiko:"
    echo "  - Migrasi tidak otomatis dibalik saat rollback. Kode lama di atas skema baru bisa error."
    echo "  - Rollback penuh bila skema berubah berarti memulihkan backup: data yang masuk setelah deploy hilang."
    [[ "$ci" == "success" ]] || echo "  - CI belum lulus untuk commit ini: deploy akan ditolak."
    echo
    echo "Strategi rollback: scripts/rollback.sh ke rilis sebelumnya yang tercatat sehat (pemindahan symlink)."
    echo "  Pemulihan database hanya dengan persetujuan terpisah (lihat docs/deployment/rollback-guide.md)."
    echo
    if [[ -z "$migrasi" ]]; then
        echo "Perkiraan downtime: tidak ada (pemindahan symlink atomik, reload PHP-FPM)."
    else
        echo "Perkiraan downtime: mode pemeliharaan selama migrasi, sekitar 10 sampai 60 detik."
    fi
    echo "Izin yang dibutuhkan: akun $DEPLOY_USER (tulis ke $APP_ROOT dan folder backup, reload $PHP_FPM_SERVICE lewat sudo terbatas)."
    echo
    echo "Untuk menyetujui, jalankan sendiri (bukan otomatis):"
    echo "  DEPLOY_APPROVED_SHA=$sha $([[ -n "$migrasi" ]] && echo 'DEPLOY_APPROVED_MIGRATIONS=yes ')scripts/deploy.sh run $sha"
}

cmd_run() {
    local sha="$1" ci pending tarball checksum
    # Status ini sengaja global: handler EXIT berjalan setelah fungsi ini selesai.
    id="" token="" bangun="" melakukan_maintenance=0 diaktifkan=0 disiapkan=0 langkah="persiapan"
    validate_transport
    require_env HEALTH_URL
    require_commands git tar

    [[ "${DEPLOY_APPROVED_SHA:-}" == "$sha" ]] \
        || die "belum disetujui. Jalankan 'plan', baca rencananya, lalu isi DEPLOY_APPROVED_SHA=$sha (persetujuan sebelumnya tidak berlaku untuk commit lain)"

    verify_commit "$sha"
    ci="$(ci_status "$sha")"
    [[ "$ci" == "success" ]] || die "CI belum lulus untuk $sha (status: $ci). Deploy ditolak; tidak ada cara melewatinya"

    if [[ "$(remote status | grep '^current_sha=' | cut -d= -f2-)" == "$sha" ]]; then
        log "Commit $sha sudah menjadi rilis aktif; tidak ada yang dilakukan."
        return 0
    fi

    id="$(date '+%Y%m%d%H%M%S')-${sha:0:7}"
    token="$id-$$"
    bangun="$(mktemp -d)"
    tarball="$bangun/release.tar.gz"

    remote init
    remote lock "$token"

    # shellcheck disable=SC2329 # dipanggil lewat trap
    selesai() {
        local kode=$?
        if [[ $kode -ne 0 ]]; then
            log "DEPLOY GAGAL pada langkah: $langkah"
            remote record "deploy GAGAL id=$id sha=$sha langkah=$langkah" || true
            if [[ $melakukan_maintenance -eq 1 ]]; then
                log "APLIKASI MASIH DALAM MODE PEMELIHARAAN. Periksa penyebabnya; backup: lihat log. Lihat docs/deployment/rollback-guide.md"
            fi
            if [[ $diaktifkan -eq 0 && $disiapkan -eq 1 ]]; then
                remote discard "$id" || true
                log "rilis $id belum diaktifkan dan sudah dibuang; rilis aktif tidak berubah."
            else
                log "rilis $id sudah diaktifkan. Bila perlu kembali: scripts/rollback.sh"
            fi
        fi
        remote unlock "$token" || true
        rm -rf "$bangun"
        exit "$kode"
    }
    trap selesai EXIT

    remote record "deploy MULAI id=$id sha=$sha oleh=$(id -un)"

    langkah="build aset"
    log "Menyusun rilis dari commit $sha"
    mkdir -p "$bangun/src"
    git -C "$REPO_ROOT" archive --format=tar "$sha" | tar -x -C "$bangun/src"
    (cd "$bangun/src" && bash -c "${BUILD_CMD:-npm ci --no-audit --no-fund && npm run build}")
    rm -rf "$bangun/src/node_modules"
    tar -czf "$tarball" -C "$bangun/src" .
    if command -v sha256sum >/dev/null 2>&1; then
        checksum="$(sha256sum "$tarball" | cut -d' ' -f1)"
    else
        checksum="$(shasum -a 256 "$tarball" | cut -d' ' -f1)"
    fi

    langkah="unggah arsip"
    local remote_tmp="$APP_ROOT/incoming-$id.tar.gz"
    push_file "$tarball" "$remote_tmp"

    langkah="persiapan rilis (composer)"
    remote prepare "$id" "$remote_tmp" "$checksum" "$sha"
    disiapkan=1
    remote record "arsip diterima id=$id checksum=${checksum:0:12}"

    langkah="tinjauan migrasi"
    pending="$(remote pending "$id")"
    if [[ -n "$pending" ]]; then
        log "Migrasi yang akan dijalankan:"
        printf '%s\n' "$pending" | indent >&2
        [[ "${DEPLOY_APPROVED_MIGRATIONS:-}" == "yes" ]] \
            || die "ada migrasi baru dan belum disetujui. Tinjau, lalu isi DEPLOY_APPROVED_MIGRATIONS=yes"
    fi

    langkah="backup database"
    remote backup "$id" | indent >&2

    if [[ -n "$pending" ]]; then
        langkah="migrasi database"
        melakukan_maintenance=1
        remote down
        remote migrate "$id" --approved
    fi

    langkah="cache Laravel"
    remote optimize "$id"

    langkah="aktivasi"
    remote activate "$id"
    diaktifkan=1
    if [[ $melakukan_maintenance -eq 1 ]]; then
        remote up "$id"
        melakukan_maintenance=0
    fi

    langkah="pemeriksaan kesehatan"
    remote health
    remote mark-ok "$id"
    remote record "deploy SUKSES id=$id sha=$sha"

    langkah="pembersihan"
    remote cleanup

    log "SELESAI. Rilis aktif: $id ($sha)"
    echo "$id"
}

main() {
    local perintah="${1:-}" ref="${2:-}"
    [[ -n "$perintah" && -n "$ref" ]] || usage
    local sha
    sha="$(resolve_commit "$ref")"
    case "$perintah" in
        plan) cmd_plan "$sha" ;;
        run) cmd_run "$sha" ;;
        *) usage ;;
    esac
}

main "$@"
