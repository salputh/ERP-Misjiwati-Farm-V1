# Deploy ERP Misjiwati Farm

Panduan memasang aplikasi di satu VPS dari nol, men-deploy versi baru, rollback, dan memulihkan backup.

**Susunan produksi:** Nginx → PHP-FPM 8.5 → Laravel 13, database SQLite (mode WAL) di luar folder aplikasi. Aplikasi tidak memakai queue worker maupun scheduler, jadi Supervisor dan cron `schedule:run` **tidak diperlukan**. Satu-satunya cron adalah backup harian.

Contoh di bawah memakai Ubuntu 24.04, domain `erp.contoh-domain.id`, user deploy `deploy`, dan lokasi berikut:

| Isi | Lokasi |
| --- | --- |
| Kode aplikasi | `/var/www/erp-misjiwati` |
| Database | `/var/lib/erp-misjiwati/database.sqlite` |
| Backup lokal | `/var/backups/erp-misjiwati` |

## 1. Setup VPS dari nol

### 1.1 Paket sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y software-properties-common git unzip curl acl sqlite3 nginx certbot ufw

# PHP 8.5 beserta ekstensi yang dibutuhkan composer.lock
sudo add-apt-repository -y ppa:ondrej/php
sudo apt install -y php8.5-fpm php8.5-cli php8.5-sqlite3 php8.5-mbstring php8.5-xml \
    php8.5-gd php8.5-zip php8.5-intl php8.5-bcmath php8.5-curl

# Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Node.js 22 LTS (Vite 8 butuh Node 20.19+ atau 22.12+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# rclone untuk menyalin backup ke penyimpanan luar
curl https://rclone.org/install.sh | sudo bash
```

### 1.2 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 1.3 User deploy

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG www-data deploy
# Izinkan deploy me-reload PHP-FPM tanpa password (dipakai deploy.sh)
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload php8.5-fpm' | sudo tee /etc/sudoers.d/deploy-php-fpm
sudo chmod 440 /etc/sudoers.d/deploy-php-fpm
```

Tambahkan SSH public key Anda ke `/home/deploy/.ssh/authorized_keys`, lalu jadikan repo GitHub dapat dibaca server (deploy key read-only di GitHub → Settings → Deploy keys).

### 1.4 Kode aplikasi

```bash
sudo mkdir -p /var/www/erp-misjiwati
sudo chown deploy:www-data /var/www/erp-misjiwati
sudo -iu deploy
git clone git@github.com:salputh/ERP-Misjiwati-Farm-V1.git /var/www/erp-misjiwati
cd /var/www/erp-misjiwati
git checkout main
```

### 1.5 Folder database

```bash
sudo mkdir -p /var/lib/erp-misjiwati
sudo chown deploy:www-data /var/lib/erp-misjiwati
sudo chmod 2770 /var/lib/erp-misjiwati      # setgid: file baru ikut grup www-data
```

Folder database harus bisa **ditulis** oleh PHP-FPM, bukan hanya file `.sqlite`-nya, karena SQLite membuat file `-wal` dan `-shm` di sebelahnya.

### 1.6 Konfigurasi `.env`

```bash
cd /var/www/erp-misjiwati
cp .env.production.example .env
chmod 640 .env
nano .env                       # isi APP_URL dengan domain https Anda
php artisan key:generate --force
```

Pastikan nilai berikut: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://...`, `SESSION_SECURE_COOKIE=true`, `LOG_CHANNEL=daily`, `LOG_LEVEL=warning`, `DB_DATABASE=/var/lib/erp-misjiwati/database.sqlite`.

### 1.7 Instalasi pertama

```bash
composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build
touch /var/lib/erp-misjiwati/database.sqlite
php artisan migrate --force
php artisan optimize
```

**Seeder tidak dijalankan di produksi.** Data diisi lewat aplikasi.

### 1.8 Izin folder

```bash
cd /var/www/erp-misjiwati
sudo chgrp -R www-data storage bootstrap/cache /var/lib/erp-misjiwati
sudo chmod -R ug+rwX storage bootstrap/cache /var/lib/erp-misjiwati
# ACL agar file yang dibuat deploy (artisan) maupun www-data (web) tetap bisa ditulis keduanya
sudo setfacl -R -m g:www-data:rwX -dm g:www-data:rwX storage bootstrap/cache /var/lib/erp-misjiwati
sudo setfacl -R -m u:deploy:rwX -dm u:deploy:rwX storage bootstrap/cache /var/lib/erp-misjiwati
```

Folder lain cukup dibaca www-data. `.env` berizin 640 (deploy:www-data).

### 1.9 Akun pengguna pertama

Tidak ada akun bawaan. Buat akun dari server:

```bash
php artisan pengguna:atur pemilik@contoh-domain.id --nama="Nama Pemilik"
```

Perintah yang sama dipakai untuk mengganti password pengguna yang lupa. Password minimal 12 karakter.

### 1.10 PHP-FPM

Di `/etc/php/8.5/fpm/php.ini` (lalu `sudo systemctl restart php8.5-fpm`):

```ini
expose_php = Off
memory_limit = 256M
upload_max_filesize = 20M
post_max_size = 20M
opcache.enable = 1
opcache.memory_consumption = 128
opcache.validate_timestamps = 1
```

`memory_limit` 256M memberi ruang untuk ekspor PDF/Excel.

### 1.11 Nginx dan SSL

```bash
sudo mkdir -p /var/www/certbot
sudo cp /var/www/erp-misjiwati/deploy/nginx.conf.example /etc/nginx/sites-available/erp-misjiwati
sudo nano /etc/nginx/sites-available/erp-misjiwati      # ganti domain
sudo rm -f /etc/nginx/sites-enabled/default
```

Sertifikat belum ada pada pemasangan pertama, jadi Nginx tidak bisa dimulai dengan blok 443. Urutannya:

1. Sementara beri tanda `#` pada seluruh blok `server { listen 443 ... }`.
2. `sudo ln -s /etc/nginx/sites-available/erp-misjiwati /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`
3. `sudo certbot certonly --webroot -w /var/www/certbot -d erp.contoh-domain.id`
4. Hapus tanda `#` pada blok 443, lalu `sudo nginx -t && sudo systemctl reload nginx`.

Perpanjangan otomatis sudah diatur certbot (`systemctl list-timers | grep certbot`). Tambahkan reload Nginx setelah perpanjangan:

```bash
echo 'deploy-hook = systemctl reload nginx' | sudo tee -a /etc/letsencrypt/cli.ini
```

### 1.12 Pemeriksaan

```bash
curl -fsS https://erp.contoh-domain.id/up          # 200
curl -sI https://erp.contoh-domain.id/.env          # 404
curl -sI https://erp.contoh-domain.id/dashboard     # 302 ke /masuk
```

## 2. Backup

Skrip `scripts/backup-sqlite.sh` memakai `sqlite3 .backup` (aman walau aplikasi sedang menulis), memeriksa `integrity_check`, mengompres, menghapus backup lokal yang lebih tua dari 14 hari, dan opsional mengunggah ke penyimpanan luar dengan rclone.

```bash
sudo mkdir -p /var/backups/erp-misjiwati && sudo chown deploy:www-data /var/backups/erp-misjiwati
sudo -iu deploy
rclone config                                   # buat remote, mis. "b2" (Backblaze B2), "gdrive", atau S3
/var/www/erp-misjiwati/scripts/backup-sqlite.sh # uji sekali
crontab -e
```

Isi crontab user `deploy`:

```cron
15 2 * * * RCLONE_TUJUAN="b2:misjiwati-backup/erp" /var/www/erp-misjiwati/scripts/backup-sqlite.sh >> /home/deploy/backup.log 2>&1
```

Uji pemulihan backup (bagian 5) minimal sekali setelah setup dan berkala tiap bulan. Backup yang belum pernah diuji dipulihkan belum bisa diandalkan.

## 3. Deploy versi baru

Gabungkan perubahan ke `main` dan push ke GitHub, lalu di server:

```bash
sudo -iu deploy
/var/www/erp-misjiwati/deploy/deploy.sh
```

Skrip ini menyalakan mode pemeliharaan, mem-backup database, menarik `main`, memasang dependency, mem-build aset, menjalankan migrasi, membuat cache, me-reload PHP-FPM, lalu membuka aplikasi kembali. Commit sebelum deploy dicatat di `storage/app/deploy-sebelumnya`.

Bila satu langkah gagal, skrip berhenti dan **aplikasi tetap dalam mode pemeliharaan**. Perbaiki penyebabnya lalu jalankan ulang, atau lakukan rollback.

## 4. Rollback

### 4.1 Kode saja (rilis baru tidak berisi migrasi)

```bash
cd /var/www/erp-misjiwati
php artisan down
git checkout "$(cat storage/app/deploy-sebelumnya)"
composer install --no-dev --optimize-autoloader --no-interaction
npm ci && npm run build
php artisan optimize
sudo systemctl reload php8.5-fpm
php artisan up
```

`git checkout <commit>` membuat repo berada di "detached HEAD". Deploy berikutnya lewat `deploy.sh` mengembalikannya ke `main`.

### 4.2 Rilis yang membawa migrasi

Pilih salah satu:

- **Membatalkan migrasi** bila migrasinya punya `down()` yang benar dan belum ada data penting yang ditulis setelah deploy: jalankan `php artisan migrate:rollback --force --step=<jumlah migrasi baru>` **sebelum** `git checkout` pada langkah 4.1.
- **Memulihkan backup pra-deploy** (paling aman bila ragu): lakukan langkah 4.1, lalu pulihkan backup yang dibuat `deploy.sh` tepat sebelum migrasi (file terbaru di `/var/backups/erp-misjiwati`) mengikuti bagian 5. Data yang ditulis setelah deploy akan hilang.

## 5. Memulihkan backup

```bash
cd /var/www/erp-misjiwati
php artisan down

# 1. Simpan dulu database saat ini, untuk berjaga-jaga
cp /var/lib/erp-misjiwati/database.sqlite /var/lib/erp-misjiwati/database.sqlite.sebelum-pulih-$(date +%Y%m%d%H%M)

# 2. Ambil backup (lokal, atau dari luar: rclone copy b2:misjiwati-backup/erp/database-YYYYMMDD-HHMMSS.sqlite.gz /tmp/)
gunzip -c /var/backups/erp-misjiwati/database-YYYYMMDD-HHMMSS.sqlite.gz > /tmp/pulih.sqlite
sqlite3 /tmp/pulih.sqlite 'PRAGMA integrity_check;'     # harus "ok"

# 3. Ganti database; file -wal dan -shm lama harus ikut dihapus
sudo systemctl stop php8.5-fpm
rm -f /var/lib/erp-misjiwati/database.sqlite-wal /var/lib/erp-misjiwati/database.sqlite-shm
mv /tmp/pulih.sqlite /var/lib/erp-misjiwati/database.sqlite
chgrp www-data /var/lib/erp-misjiwati/database.sqlite && chmod 660 /var/lib/erp-misjiwati/database.sqlite
sudo systemctl start php8.5-fpm

# 4. Bila backup berasal dari versi kode yang lebih lama, jalankan migrasi yang belum ada
php artisan migrate --force
php artisan up
```

Setelah dipulihkan, sesi login yang tersimpan di database ikut kembali ke keadaan saat backup, jadi pengguna mungkin perlu masuk ulang.

## 6. Pemantauan dan log

- Health check: `GET /up` (200 bila aplikasi bisa melayani permintaan). Bisa dipantau dengan UptimeRobot atau sejenisnya.
- Log aplikasi: `storage/logs/laravel-YYYY-MM-DD.log` (harian, disimpan 14 hari, level warning ke atas).
- Log Nginx: `/var/log/nginx/erp-misjiwati.*.log`.
- Log backup: `/home/deploy/backup.log`.

## 7. Queue dan scheduler

Saat ini aplikasi tidak punya job antrean maupun jadwal (`routes/console.php` tidak menjadwalkan apa pun), sehingga tidak perlu Supervisor atau cron `schedule:run`. Bila nanti ditambahkan:

- Scheduler: cron `* * * * * cd /var/www/erp-misjiwati && php artisan schedule:run >> /dev/null 2>&1` di user `deploy`.
- Queue: program Supervisor yang menjalankan `php artisan queue:work --sleep=3 --tries=3 --max-time=3600` sebagai `www-data`, dan tambahkan `php artisan queue:restart` ke `deploy.sh`.
