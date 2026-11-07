# Audit infrastruktur, rencana deployment, dan usulan arsitektur

Tanggal audit: 7 November 2026. Phase 1 (audit) selesai, termasuk pemeriksaan baca-saja ke VPS. Skrip deploy dan rollback belum dibuat dan menunggu persetujuan.

Sumber: repositori, `deploy/DEPLOY.md`, API Hostinger (baca-saja), dan dua sesi SSH baca-saja dengan kunci sementara yang sudah dicabut (bagian 8). Isi `.env` tidak dibaca, hanya nama variabel non-rahasia. Nilai kunci, sandi, dan token disamarkan.

## 1. Temuan utama

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | **Database produksi adalah SQLite**, bukan MySQL: `/var/www/erp/database/database.sqlite`. MySQL di VPS dipakai proyek lain (`erp_kayujati`, `kandang_suite`). | Backup dan rollback memakai `sqlite3 .backup`, bukan `mysqldump`. Brief diubah menyesuaikan. |
| 2 | **Backup tidak berjalan.** Tidak ada cron untuk root, deploy, maupun www-data. Backup terakhir bertanggal 29 Oktober 2026 (6 file di `/var/backups/erp-misjiwati`). | Sebelum migrasi apa pun, backup baru dan terverifikasi wajib dibuat. Backup harian perlu dipasang. |
| 3 | **Tidak ada CI.** Tidak ada `.github/` di repositori. Pest dan Larastan tidak terpasang (PHPUnit 12 dan Pint saja). | "CI harus lulus untuk commit yang di-deploy" belum bisa diperiksa. |
| 4 | **Produksi ada di commit `2daa944` (merge PR #5, branch `main`).** Semua pekerjaan terbaru (UI Basalt, migrasi nomor siklus, `AdminSeeder`) belum di-commit, dan branch lokal adalah `demo/portfolio`. | Belum ada commit target yang bisa di-deploy. |
| 5 | **Deploy berjalan di tempat** (`git pull` di `/var/www/erp`, tanpa folder rilis dan tanpa symlink `current`), dengan mode pemeliharaan. | Ada downtime dan tidak ada rilis lama untuk rollback cepat. |
| 6 | **Akun `deploy` tidak bisa login lewat SSH:** `authorized_keys`-nya kosong (0 byte). Akun itu punya `sudo` penuh (`ALL : ALL`). | Akun non-root belum bisa dipakai, dan haknya terlalu luas (bertentangan dengan least privilege). |
| 7 | **Kunci SSH lama di root belum dicabut:** `claude-deploy-kayujati` (proyek lain) dan satu kunci tanpa nama. Keduanya tidak saya ubah. | Perlu keputusan Anda kunci mana yang masih dipakai. |
| 8 | **SSH terlalu longgar:** `PermitRootLogin yes` dan `PasswordAuthentication yes` (efektif, dari `sshd -T`). Fail2ban dan UFW aktif, jadi ada perlindungan dasar. | Login root dan sandi sebaiknya dimatikan setelah akun `deploy` siap. Jangan dilakukan sebelum akses lain terjamin. |
| 9 | **Server perlu reboot** (`/var/run/reboot-required`) dan ada 14 paket belum diperbarui. | Jadwalkan terpisah dari deploy. |
| 10 | **Beberapa aplikasi berbagi satu VPS** (1 vCPU, 4 GB): `/var/www/erp` (produksi ini), `erp-misjiwati-demo`, `erp-kayujati`, `kandang`, `salman-portfolio`. Memori terpakai sekitar 1,3 GB dari 3,9 GB. | Build Vite dan `composer install` di server bersaing dengan aplikasi lain. Aset sebaiknya dibuild di luar server. Skrip tidak boleh menyentuh aplikasi lain. |
| 11 | **Tidak ada staging.** | Pengujian skrip memakai folder sementara lokal, tidak di produksi. |

## 2. Proyek (dari repositori)

| Item | Nilai |
|------|-------|
| Laravel | 13.34.0 (`^13.17`) |
| PHP | `^8.3`. Lokal 8.5.12, server 8.5.4 |
| Node / npm | Lokal 26.12.1 / 11.20.0. Server 22.23.4 / 10.9.9. Vite 8, Tailwind 4 |
| Test | PHPUnit 12, 419 test lulus. Pint bersih |
| Aset Vite | `public/build` ada di `.gitignore`, jadi harus dibuild saat deploy |
| Aset Basalt | `public/assets/basalt` (21 MB) dan `public/assets/vendor` (3,8 MB) belum dilacak Git. Folder `basalt/` (70 MB, dokumentasi dan halaman contoh) tidak perlu masuk produksi |
| Health check | `/up` aktif |
| Queue / scheduler | `QUEUE_CONNECTION=database`, tetapi tidak ada job dan tidak ada jadwal. Worker dan cron `schedule:run` belum diperlukan |
| Upload file | Tidak ada pemakaian `Storage` |
| Mode demo | `DemoMode` dan `AutoLoginDemo` ada di pipeline. `.env` produksi tidak menyetel `DEMO_MODE` (aman, bawaan nonaktif) |

## 3. VPS

| Item | Nilai |
|------|-------|
| VPS | ID 2102499, KVM 1, 1 vCPU, 4 GB RAM, disk 48 GB (terpakai 13%) |
| OS | Ubuntu 26.04.1 LTS, kernel 7.0.0-38, uptime sekitar 10 hari |
| Alamat | srv2102499.hstgr.cloud, 187.53.134.155 |
| Web server | Nginx 1.28.3. Situs aplikasi ini: `misjiwatifarm.tech` dan `www`, root `/var/www/erp/public`, PHP lewat `unix:/run/php/php8.5-fpm.sock`, SSL Let's Encrypt |
| PHP | 8.5.4 FPM aktif (8.3 dan 8.4 nonaktif). Ekstensi lengkap: bcmath, gd, intl, mbstring, pdo_sqlite, sqlite3, zip, xml, dan lainnya |
| Alat | Composer terpasang (perintah `--version` tidak menampilkan versi di sesi non-interaktif), git 2.53.0, `sqlite3` CLI ada di `/usr/bin/sqlite3` |
| Supervisor | Nonaktif (sesuai: belum ada worker) |
| Firewall | UFW aktif: OpenSSH, 80, 443. Tidak ada firewall group di sisi Hostinger |
| Aplikasi | `/var/www/erp`, pemilik `deploy:www-data`, branch `main`, remote GitHub lewat SSH (`github_deploy` di `/home/deploy/.ssh`) |
| `.env` produksi | `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://misjiwatifarm.tech`, `DB_CONNECTION=sqlite`, `LOG_CHANNEL=daily`, session, queue, dan cache `database`. 67 baris |
| `storage` dan `bootstrap/cache` | `deploy:www-data`, setgid (`drwxrwsr-x`) |
| Sudoers | Hanya `90-cloud-init-users` (memberi `deploy` akses `sudo` penuh) |

Catatan: folder `/var/www/erp` berisi file di luar kebutuhan aplikasi: PDF operasional (administrasi harian, rekap pemeliharaan), `node_modules`, `.phpunit.result.cache`, dan `deploy/`. Pastikan Nginx tetap menolak file di luar `public/` (konfigurasi contoh sudah begitu, tetapi konfigurasi aktif belum dibandingkan baris demi baris).

## 4. Risiko

**Tinggi**
1. Tidak ada backup terbaru (temuan 2). Migrasi SQLite yang menghapus kolom membangun ulang tabel. Tanpa backup terverifikasi, kegagalan di tengah bisa merusak data.
2. Tidak ada CI dan tidak ada commit target (temuan 3 dan 4).
3. Deploy di tempat dengan mode pemeliharaan: bila satu langkah gagal, aplikasi tetap mati.
4. Akun `deploy` punya sudo penuh dan SSH root masih terbuka dengan sandi (temuan 6 dan 8).

**Sedang**
5. Rollback kode tidak membalik migrasi. Kode lama setelah migrasi nomor siklus tidak akan cocok dengan skema baru (kolom `periodes.nomor_siklus` hilang).
6. Server perlu reboot dan pembaruan keamanan (temuan 9).
7. Kunci SSH lama di root (temuan 7).
8. Build di server satu vCPU bersaing dengan aplikasi lain (temuan 10).

**Rendah**
9. Berkas non-aplikasi (PDF operasional) ada di folder aplikasi, tidak terlayani web tetapi sebaiknya tidak di sana.

## 5. Rencana deployment (DRAF, menunggu persetujuan)

Belum ada rencana yang bisa disetujui untuk dijalankan karena commit target dan CI belum ada. Isi di bawah menyatakan status sebenarnya dan akan dilengkapi sebelum deploy pertama.

| Item | Status |
|------|--------|
| Commit produksi sekarang | `2daa944` (branch `main`) |
| Commit target | **Belum ada.** Perubahan masih berupa 148 file belum di-commit di `demo/portfolio` |
| Hasil CI | **Belum ada CI.** Hasil lokal: PHPUnit 419 lulus, Pint bersih (belum diverifikasi dari commit bersih) |
| Perubahan migrasi | 1 migrasi baru: `2026_11_07_093953_move_nomor_siklus_to_periode_kandangs`. Menambah `periode_kandangs.nomor_siklus` (disalin dari periode), membuat indeks unik `(kandang_id, nomor_siklus)`, lalu **menghapus `periodes.nomor_siklus`**. Sudah diuji migrate, rollback, migrate di salinan database demo. Belum diuji pada salinan database produksi |
| Backup | Backup terakhir 29 Oktober, tidak ada cron. Backup baru wajib sebelum migrasi |
| Risiko | Bagian 4, terutama poin 1, 2, 5 |
| Rollback | Kembalikan kode ke `2daa944`/rilis sebelumnya. Karena migrasi menghapus kolom, rollback penuh berarti memulihkan database dari backup (perlu persetujuan eksplisit dan kehilangan data yang masuk setelah deploy) atau menjalankan `down()` migrasi (menyalin nilai siklus kembali). Tidak dilakukan otomatis |
| Perkiraan downtime | Deploy lama (in-place): sekitar 1 sampai 3 menit mode pemeliharaan, lebih lama untuk build di server. Rilis berversi: nyaris nol untuk kode, sekitar 10 sampai 30 detik pemeliharaan untuk migrasi yang mengubah skema |
| Izin yang dibutuhkan | Akses SSH ke akun `deploy` (belum ada), reload PHP-FPM, tulis ke `/var/www/erp`, baca-tulis ke database SQLite |

## 6. Usulan arsitektur

Struktur direktori (aplikasi produksi saat ini berada langsung di `/var/www/erp`, jadi perpindahan ke struktur rilis berversi butuh langkah migrasi satu kali, yang akan saya rencanakan terpisah dan perlu persetujuan):

```
/var/www/erp/
  releases/<tanggal>-<sha>/   tiap rilis, tidak diubah setelah dibuat
  shared/.env                 dipertahankan, tidak pernah ditimpa
  shared/storage/             log, cache, sesi file
  current -> releases/<...>   symlink atomik
  deploy.log                  catatan deploy dan rollback (SHA, waktu, hasil)
```
Database SQLite berada di luar rilis dan tidak ikut dipindah. Nginx cukup mengarahkan `root` ke `.../current/public` (konfigurasi sudah memakai `$realpath_root`).

Urutan deploy: validasi commit dan CI, rencana deployment menunggu persetujuan, backup SQLite beserta `integrity_check`, kirim kode dan aset yang dibuild di luar server, `composer install --no-dev`, hubungkan `.env` dan `storage`, tinjau migrasi (berhenti dan minta persetujuan bila ada `drop` atau perubahan skema), `migrate --force`, `optimize`, pindahkan symlink, reload PHP-FPM, cek `/up`, catat hasil, simpan 5 rilis terakhir. Tidak pernah memakai `migrate:fresh` atau `migrate:refresh`. Rollback hanya memindahkan symlink, tidak pernah membalik migrasi otomatis.

Akses SSH: akun `deploy` dengan hak minimum (satu aturan sudoers untuk reload PHP-FPM, tanpa sudo penuh), kunci sementara dibuat per deploy, `known_hosts` dipin (sidik jari ED25519 server: `SHA256:elLch+aC7ynZL09ssTADTN1jQW9f2PZ768BpZ5WSgHw`, diambil lewat `ssh-keyscan` tanpa pembanding di luar jalur, jadi masih berbasis kepercayaan pertama), dan pencabutan diverifikasi.

## 7. Keputusan yang saya butuhkan

1. **Persetujuan Phase 2** (rancangan di bagian 6), termasuk apakah aplikasi produksi dipindah ke struktur rilis berversi.
2. **CI:** buat GitHub Actions dengan yang ada (Pint, PHPUnit, `composer audit`, `npm audit`, build Vite), atau tambah Larastan/Pest (mengubah dependensi, perlu izin Anda).
3. **Commit:** boleh saya merapikan perubahan menjadi commit di branch baru dari `main` (tanpa folder `basalt/`) untuk Anda tinjau?
4. **Akun `deploy`:** boleh saya merancang pembatasan sudo dan pengisian `authorized_keys`-nya (langkah ini mengubah server, jadi hanya dijalankan setelah rencananya Anda setujui)?
5. **Kunci SSH lama di root:** kunci mana yang masih dipakai?
6. **Backup harian:** boleh dipasang (cron untuk `deploy`) sebagai bagian dari rencana?

## 8. Catatan akses SSH sementara selama audit

- Kunci ed25519 dibuat di folder sementara sesi ini (komentar `audit-temp-erp-misjiwati-20261107`), dipasang lewat API Hostinger, dipakai untuk dua sesi baca-saja, lalu dihapus dari `/root/.ssh/authorized_keys` (hanya baris itu).
- Diverifikasi: login ulang dengan kunci itu ditolak, daftar kunci di API sama dengan kondisi awal (2 kunci), dan kunci privat serta publik lokal dihapus. Kunci akses API/MCP Hostinger adalah hal terpisah dan tidak berubah.
- **Perubahan kecil yang tertinggal di server, harus saya laporkan:** (a) `/root/.ssh/authorized_keys.bak-audit-20261107`, salinan cadangan file kunci yang berisi baris kunci sementara (tidak dibaca sshd, tidak berfungsi sebagai akses, tetapi sebaiknya dihapus); (b) `git config --global --add safe.directory /var/www/erp` di `/root/.gitconfig`, yang saya jalankan agar `git log` bisa dibaca sebagai root. Keduanya tidak memengaruhi aplikasi.

## 9. Keputusan pemilik (7 November 2026) dan tindak lanjut

1. Rancangan Phase 2 disetujui: rilis berversi, skrip deploy dan rollback. Selesai dibuat dan diuji di sandbox (lihat `README.md`).
2. CI: dibuat lengkap (Pint, Larastan, PHPUnit + coverage, `composer audit`, `npm audit`, build Vite, ShellCheck, uji skrip deploy, job gerbang "CI lulus", Dependabot). Larastan ditambahkan sebagai dev dependency.
3. Commit diizinkan: tiga commit di branch `release/ui-basalt` (belum di-push).
4. Rancangan pembatasan sudo, kunci akun `deploy`, dan backup harian diizinkan. Hasilnya `scripts/server-setup.sh` (dry-run bawaan). Perubahan ke server baru dijalankan setelah persetujuan terpisah.
5. Dua kunci root: keduanya dinyatakan masih dipakai, jadi tidak dicabut. `claude-deploy-kayujati` jelas milik proyek lain. Pemilik kunci tanpa nama belum bisa dipastikan dari sini.
6. Temuan tambahan saat menyiapkan CI: `composer audit` melaporkan 8 advisori pada paket Symfony produksi. Sudah diperbarui dan audit bersih.
