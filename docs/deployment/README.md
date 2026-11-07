# Deployment ERP Misjiwati Farm

Deploy memakai rilis berversi dan pemindahan symlink yang atomik, dengan persetujuan manual dari pemilik di setiap deploy. Latar belakang temuan dan risikonya ada di [infrastructure-audit.md](infrastructure-audit.md).

**Status:** skrip sudah dibuat dan lulus 100 pemeriksaan di sandbox lokal. **Belum pernah dijalankan di server produksi.** Langkah penyiapan server (bagian 2) dan deploy pertama masing-masing butuh persetujuan terpisah.

## 1. Cara kerja

```
mesin operator                                    server (akun deploy)
--------------                                    --------------------
scripts/deploy.sh plan <sha>   --ssh (baca)-->    status rilis aktif, backup terakhir
scripts/deploy.sh run  <sha>   --ssh/scp-->       releases/<id>/   rilis baru (aset sudah dibuild)
   build aset dari git archive                    shared/.env      dipertahankan, tidak pernah ditimpa
   cek CI, cek commit, cek persetujuan            shared/storage/  dipertahankan
                                                  current -> releases/<id>   dipindah atomik
```

Urutan `run`:
1. Memeriksa persetujuan, bahwa commit ada di `origin/main`, pohon kerja bersih, dan CI hijau untuk commit itu.
2. Mengunci server (satu deploy pada satu waktu), menyusun rilis dari `git archive <sha>` (bukan dari folder kerja), membangun aset Vite di mesin operator, dan mengunggah arsip dengan checksum SHA-256.
3. Di server: `composer install --no-dev`, menautkan `shared/.env` dan `shared/storage`.
4. Meninjau migrasi yang belum jalan. Bila ada, deploy berhenti sampai Anda menyetujuinya.
5. Backup SQLite (`.backup` + `integrity_check` + `gzip -t`).
6. Bila ada migrasi: mode pemeliharaan, `migrate --force`. Bila tidak ada: tanpa downtime.
7. `optimize`, memindahkan symlink `current`, reload PHP-FPM, mencabut mode pemeliharaan.
8. Cek kesehatan (`/up`). Rilis hanya ditandai "sehat" bila lolos. Rilis lama disimpan (5 terakhir).

Kegagalan di langkah mana pun menghentikan proses, mencatat langkahnya di `deploy.log`, membuang rilis yang belum diaktifkan, dan melepas kunci. Bila gagal saat migrasi, aplikasi **sengaja dibiarkan dalam mode pemeliharaan** supaya tidak ada yang menulis ke data setengah jadi.

Yang tidak pernah dilakukan skrip: `migrate:fresh`, `migrate:refresh`, `migrate:rollback`, `migrate:reset`, `db:wipe`, memulihkan database, menimpa `.env`, menyentuh aplikasi lain di VPS.

## 2. Penyiapan server (satu kali, perlu persetujuan)

Hanya dilakukan setelah Anda menyetujui rencananya. Semuanya dry-run secara bawaan.

```bash
# 1. Di mesin operator: buat kunci sementara dan ambil sidik jari server
export DEPLOY_HOST=187.53.134.155
scripts/ssh-access.sh pin          # bandingkan sidik jari dengan konsol/hPanel
scripts/ssh-access.sh new          # mencetak baris "restrict ssh-ed25519 ..."

# 2. Di server sebagai root (lihat "Akses root" di security-checklist.md)
scripts/server-setup.sh prepare                  # dry-run: baca dulu
scripts/server-setup.sh --apply prepare          # folder, .env disalin (tidak menimpa), sudoers terbatas, cron backup harian
scripts/server-setup.sh --apply install-key "restrict ssh-ed25519 AAAA... deploy-temp-erp-..."

# 3. Deploy pertama (lihat bagian 3), lalu setelah /up sehat:
scripts/server-setup.sh --apply switch-nginx     # arahkan Nginx ke current/public
```

Aplikasi lama di `/var/www/erp` tidak dihapus dan tidak dimatikan: ia tetap menjadi cadangan sampai Anda yakin, dan database SQLite tetap di lokasi lamanya (`DB_DATABASE` di `.env` tidak berubah). Mengembalikan Nginx ke `/var/www/erp/public` adalah rollback penuh dari perpindahan ini.

## 3. Menjalankan deploy

```bash
export DEPLOY_HOST=187.53.134.155
export DEPLOY_SSH_KEY=~/.cache/erp-deploy-access/deploy_key
export DEPLOY_KNOWN_HOSTS=~/.cache/erp-deploy-access/known_hosts
export HEALTH_URL=https://misjiwatifarm.tech

scripts/deploy.sh plan <commit>          # 1. baca DEPLOYMENT PLAN
```

**Cara menyetujui.** Rencana mencetak perintah persetujuan untuk commit itu. Jalankan sendiri, setelah membaca rencananya:

```bash
DEPLOY_APPROVED_SHA=<sha penuh> scripts/deploy.sh run <commit>
# bila rencana memuat migrasi baru, tambahkan juga:
DEPLOY_APPROVED_MIGRATIONS=yes DEPLOY_APPROVED_SHA=<sha penuh> scripts/deploy.sh run <commit>
```

Persetujuan hanya berlaku untuk SHA yang tertulis. Agen AI tidak boleh mengisi variabel ini sendiri. Persetujuan sebelumnya tidak berlaku untuk deploy berikutnya.

## 4. Memastikan berhasil

- Keluaran akhir: `SELESAI. Rilis aktif: <id>`.
- `scripts/rollback.sh list` menampilkan `current`, `current_sha`, dan `previous`.
- `curl -fsS https://misjiwatifarm.tech/up` mengembalikan 200, dan halaman `/masuk` terbuka.
- Di server: `tail /var/www/erp-releases/deploy.log` memuat `deploy SUKSES`.
- Coba satu alur nyata (login, buka Periode), bukan hanya `/up`.

## 5. Bila gagal

Lihat [rollback-guide.md](rollback-guide.md). Ringkasnya:
- Gagal sebelum aktivasi: tidak ada yang berubah di produksi. Perbaiki penyebabnya dan ulangi (butuh persetujuan baru).
- Gagal saat migrasi: aplikasi dalam mode pemeliharaan. Backup pra-deploy ada di `/var/backups/erp-misjiwati/database-predeploy-<id>.sqlite.gz`.
- Gagal di cek kesehatan setelah aktivasi: pilih `scripts/rollback.sh` (kode) setelah menimbang skema.

## 6. Akses SSH sementara

`scripts/ssh-access.sh` membuat kunci ed25519 per sesi, dipasang sebagai kunci akun `deploy` (bukan root) dengan opsi `restrict`, dan dicabut setelah selesai: baris dihapus dari `authorized_keys`, login ulang diuji dan harus ditolak, lalu berkas lokal dihapus. Kunci host server dipin di `known_hosts` yang dipakai skrip (`StrictHostKeyChecking=yes`). Detail dan batasannya ada di [security-checklist.md](security-checklist.md).

## 7. CI

`.github/workflows/ci.yml` menjalankan Pint, Larastan (level 0), PHPUnit dengan coverage, `composer audit`, `npm audit` (paket produksi), build Vite, ShellCheck, dan uji skrip deploy. Job gerbang bernama **CI lulus** adalah yang diperiksa `deploy.sh`. Aktifkan branch protection di GitHub supaya `main` hanya menerima PR yang lulus job itu.

## 8. Pengujian skrip

```bash
scripts/tests/test-deploy.sh      # sandbox lokal, tidak menyentuh produksi
shellcheck -x --severity=style scripts/*.sh scripts/*/*.sh
```
Mencakup: rencana hanya-baca, penolakan tanpa persetujuan, CI gagal atau belum selesai, perubahan lokal, commit di luar `origin/main`, deploy sukses dan tidak menimpa `.env`, idempotensi, migrasi butuh persetujuan, kegagalan migrasi, kegagalan health check, rollback ke rilis sehat, penolakan rollback ke rilis tak dikenal atau skema lebih baru, deploy bersamaan, konfigurasi SSH tidak aman, dan pemeriksaan statis atas perintah destruktif dan rahasia.
**Belum teruji:** transport SSH sungguhan, `sudo systemctl reload`, Nginx, dan `composer install` di server (sandbox memakai transport `local`, artisan palsu, dan `COMPOSER_CMD=true`). Hal itu baru bisa dibuktikan pada deploy pertama, karena tidak ada staging.

## Skrip lama

`deploy/deploy.sh` (tarik kode di tempat dengan mode pemeliharaan) tetap ada sebagai cadangan sampai deploy berversi terbukti. Jangan dipakai bersamaan dengan skrip baru.
