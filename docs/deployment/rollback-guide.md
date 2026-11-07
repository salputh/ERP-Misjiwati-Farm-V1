# Panduan rollback

Rollback memindahkan symlink `current` ke rilis sebelumnya yang diketahui sehat. Ia **tidak pernah** membalik migrasi dan **tidak pernah** memulihkan database. Keduanya butuh keputusan dan persetujuan Anda.

## Memilih jalur

| Situasi | Jalur |
|---------|-------|
| Deploy gagal sebelum aktivasi | Tidak ada yang perlu dibatalkan. Rilis yang disiapkan sudah dibuang otomatis. |
| Rilis baru aktif, tidak ada migrasi di deploy itu | **Rollback kode** (bagian 1). Aman. |
| Rilis baru aktif, ada migrasi dan belum ada data baru yang penting | Rollback kode dengan `ROLLBACK_APPROVED_SCHEMA_AHEAD=yes`, **hanya bila** kode lama masih cocok dengan skema baru (periksa dulu). Bila tidak cocok, bagian 3. |
| Migrasi gagal di tengah deploy | Aplikasi di mode pemeliharaan. Bagian 2. |
| Data rusak atau skema tidak kompatibel | **Pemulihan database dari backup** (bagian 3), dengan persetujuan eksplisit. |

Rollback penuh dari migrasi `move_nomor_siklus_to_periode_kandangs` (yang menghapus `periodes.nomor_siklus`) berarti pemulihan backup, atau menjalankan `down()` migrasi itu secara manual. Kode lama tidak jalan di atas skema baru.

## 1. Rollback kode

```bash
export DEPLOY_HOST=... DEPLOY_SSH_KEY=... DEPLOY_KNOWN_HOSTS=... HEALTH_URL=https://misjiwatifarm.tech
scripts/rollback.sh list                      # rilis yang ada, current, previous
ROLLBACK_APPROVED=<id rilis target> scripts/rollback.sh run previous
```

Aturan yang ditegakkan skrip:
- Target harus rilis yang tercatat lolos cek kesehatan (`releases.ok`). Rilis yang gagal tidak bisa jadi target.
- `ROLLBACK_APPROVED` harus sama persis dengan id target (persetujuan lama tidak berlaku).
- Bila database memuat migrasi yang tidak ada di rilis target, skrip **berhenti** dan menampilkan daftarnya. Hanya `ROLLBACK_APPROVED_SCHEMA_AHEAD=yes` (Anda menerima risiko kode lama di skema baru) yang melanjutkan.
- Memakai kunci yang sama dengan deploy: tidak berjalan bersamaan dengan deploy.
- Hasil dicatat di `deploy.log` (`rollback MULAI`, `rollback SUKSES`/`GAGAL`) dan dicek dengan `/up`. `.env` dan `storage` tidak berubah karena bersama.

## 2. Migrasi gagal di tengah deploy

Aplikasi sengaja dibiarkan dalam mode pemeliharaan. Rilis aktif belum berubah.
1. Baca pesan galat (langkah "migrasi database") dan `tail /var/www/erp-releases/deploy.log`.
2. SQLite menjalankan tiap migrasi dalam transaksi, jadi migrasi yang gagal biasanya terbatas pada yang sedang berjalan. Periksa: `sqlite3 <db> "select migration from migrations order by id desc limit 5"`.
3. Bila data utuh: perbaiki migrasi, commit, deploy ulang dengan persetujuan baru. Lalu `php artisan up` dari rilis aktif bila perlu.
4. Bila data rusak: bagian 3.
Backup tepat sebelum migrasi: `/var/backups/erp-misjiwati/database-predeploy-<id>.sqlite.gz`.

## 3. Memulihkan database dari backup (butuh persetujuan eksplisit)

Ini menghapus semua data yang masuk setelah backup dibuat. **Jangan dijalankan tanpa persetujuan Anda untuk backup yang tepat itu.** Tidak ada skrip untuk ini, dengan sengaja.

```bash
# di server, sebagai deploy; sebelumnya: aplikasi dalam mode pemeliharaan
DB=$(grep '^DB_DATABASE=' /var/www/erp-releases/shared/.env | cut -d= -f2-)
cp -p "$DB" "$DB.sebelum-pemulihan-$(date +%Y%m%d%H%M%S)"      # simpan dulu kondisi sekarang
gunzip -c /var/backups/erp-misjiwati/database-predeploy-<id>.sqlite.gz > /tmp/pulih.sqlite
sqlite3 /tmp/pulih.sqlite 'PRAGMA integrity_check;'             # harus: ok
mv /tmp/pulih.sqlite "$DB" && rm -f "$DB-wal" "$DB-shm"
chown <pemilik semula>:www-data "$DB"; chmod 664 "$DB"
```
Lalu rollback kode ke rilis yang cocok dengan skema backup, `php artisan up`, dan cek `/up`.

## 4. Mengembalikan perpindahan Nginx

Setelah `switch-nginx`, kembalikan root Nginx ke `/var/www/erp/public` dari berkas cadangan `…/erp.bak-<waktu>`, lalu `nginx -t && systemctl reload nginx`. Aplikasi lama dan database di lokasi lamanya tidak pernah dihapus.

## 5. Setelah rollback

Catat penyebabnya, jangan deploy ulang commit yang sama sebelum diperbaiki, dan pertahankan rilis gagal di server sampai analisis selesai (skrip tidak menghapus rilis lain).
