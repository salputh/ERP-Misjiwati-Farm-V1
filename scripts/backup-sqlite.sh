#!/usr/bin/env bash
#
# Backup database SQLite ERP Misjiwati Farm.
#
# Memakai perintah ".backup" milik sqlite3 sehingga salinan tetap konsisten walau aplikasi
# sedang menulis (mode WAL). Hasilnya diperiksa dengan integrity_check, dikompres, dan file
# yang lebih tua dari BACKUP_RETENSI_HARI dihapus. Jika RCLONE_TUJUAN diisi, salinan juga
# diunggah ke penyimpanan luar.
#
# Variabel (semuanya punya nilai bawaan):
#   DB_PATH              lokasi database          (/var/lib/erp-misjiwati/database.sqlite)
#   BACKUP_DIR           folder backup lokal      (/var/backups/erp-misjiwati)
#   BACKUP_RETENSI_HARI  lama penyimpanan lokal   (14)
#   RCLONE_TUJUAN        remote rclone, mis. "b2:misjiwati-backup/erp" (kosong = tidak diunggah)
#
# Contoh cron harian pukul 02.15 (crontab -e milik user aplikasi, mis. www-data):
#   15 2 * * * RCLONE_TUJUAN="b2:misjiwati-backup/erp" /var/www/erp-misjiwati/scripts/backup-sqlite.sh >> /var/log/erp-misjiwati-backup.log 2>&1

set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/erp-misjiwati/database.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp-misjiwati}"
BACKUP_RETENSI_HARI="${BACKUP_RETENSI_HARI:-14}"
RCLONE_TUJUAN="${RCLONE_TUJUAN:-}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

if [[ ! -f "$DB_PATH" ]]; then
    log "GAGAL: database tidak ditemukan di $DB_PATH"
    exit 1
fi

command -v sqlite3 >/dev/null || { log "GAGAL: sqlite3 belum terpasang"; exit 1; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STEMPEL="$(date '+%Y%m%d-%H%M%S')"
SEMENTARA="$BACKUP_DIR/.database-$STEMPEL.sqlite"
HASIL="$BACKUP_DIR/database-$STEMPEL.sqlite.gz"

trap 'rm -f "$SEMENTARA"' EXIT

log "Membuat backup $DB_PATH"
sqlite3 "$DB_PATH" ".timeout 10000" ".backup '$SEMENTARA'"

HASIL_CEK="$(sqlite3 "$SEMENTARA" 'PRAGMA integrity_check;')"
if [[ "$HASIL_CEK" != "ok" ]]; then
    log "GAGAL: integrity_check backup tidak ok: $HASIL_CEK"
    exit 1
fi

gzip -c "$SEMENTARA" > "$HASIL"
chmod 600 "$HASIL"
log "Backup tersimpan: $HASIL ($(du -h "$HASIL" | cut -f1))"

if [[ -n "$RCLONE_TUJUAN" ]]; then
    command -v rclone >/dev/null || { log "GAGAL: rclone belum terpasang"; exit 1; }
    rclone copy "$HASIL" "$RCLONE_TUJUAN" --quiet
    log "Diunggah ke $RCLONE_TUJUAN"
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'database-*.sqlite.gz' -type f -mtime +"$BACKUP_RETENSI_HARI" -print -delete \
    | while read -r lama; do log "Dihapus (lebih dari $BACKUP_RETENSI_HARI hari): $lama"; done

log "Selesai"
