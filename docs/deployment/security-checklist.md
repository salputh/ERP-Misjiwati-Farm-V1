# Checklist keamanan deployment

Status per 7 November 2026. Tanda: [x] sudah, [ ] belum, [~] sebagian.

## Sebelum setiap deploy
- [ ] Commit ada di `origin/main` dan job **CI lulus** hijau (skrip memeriksanya).
- [ ] `scripts/deploy.sh plan <sha>` sudah dibaca, termasuk bagian migrasi dan risikonya.
- [ ] Backup terakhir segar (skrip membuat backup baru tepat sebelum deploy dan memverifikasinya).
- [ ] Persetujuan diketik sendiri oleh pemilik untuk SHA itu (`DEPLOY_APPROVED_SHA`), bukan oleh agen.
- [ ] Tidak ada rahasia di commit: `.env`, kunci, token.

## Akses SSH sementara
- [x] Kunci ed25519 baru per sesi, di folder mode 700, tidak di repositori (`scripts/ssh-access.sh new`).
- [x] Opsi `restrict` pada baris kunci: tanpa forwarding, tanpa pty, tanpa agent.
- [x] Kunci host dipin di `known_hosts` khusus dan `StrictHostKeyChecking=yes`. **Batasan:** pengambilan pertama lewat `ssh-keyscan` adalah kepercayaan pertama; cocokkan sidik jari dengan konsol/hPanel.
- [x] Pencabutan menghapus hanya baris dengan komentar unik, menguji login ulang (harus ditolak), lalu menghapus kunci lokal.
- [x] Skrip menolak `DEPLOY_USER=root`.
- [ ] Setelah sesi: daftar kunci di server dan di API Hostinger sama dengan sebelum sesi.
- **Akses API/MCP:** menghapus kunci SSH tidak mencabut token API/MCP Hostinger atau akses agen. Cabut token itu sendiri di akun Hostinger bila tidak dipakai lagi.
- **Akses root:** API Hostinger hanya menambah kunci ke root. Untuk langkah penyiapan yang butuh root, pasang kunci sementara ke root lewat API, jalankan `server-setup.sh`, lalu cabut dengan menghapus barisnya (jangan memakai endpoint hapus-kunci yang tidak menyebut kunci tertentu: ia bisa menghapus semua kunci).

## Status server (dari audit, belum diubah)
- [ ] Akun `deploy` punya sudo penuh (`ALL : ALL`). `server-setup.sh prepare` **menambah** aturan terbatas (hanya reload PHP-FPM) tetapi tidak mencabut sudo penuh, karena aplikasi demo dan lainnya masih memakai akun itu. Cabut setelah semua deploy lain dipindah.
- [ ] `PermitRootLogin yes` dan `PasswordAuthentication yes`. Matikan setelah akses `deploy` berbasis kunci terbukti (jangan sebelumnya).
- [x] UFW aktif (OpenSSH, 80, 443), fail2ban aktif.
- [ ] Dua kunci lama di root belum dicabut: `claude-deploy-kayujati` dan satu kunci tanpa nama. Pemilik kunci tanpa nama belum diketahui (tidak ada kunci publik lokal yang cocok); periksa `/var/log/auth.log` untuk login dengan kunci itu sebelum mencabut.
- [ ] Reboot tertunda dan 14 pembaruan paket.
- [ ] Backup harian belum aktif (dipasang oleh `server-setup.sh prepare`), dan salinan di luar server (rclone) belum ada.

## Rahasia
- [x] `.env` produksi tidak pernah dibaca, dibuat, atau ditimpa oleh skrip (`shared/.env` hanya disalin sekali dari aplikasi lama bila belum ada).
- [x] Skrip tidak mencetak nilai `.env`. Pengujian memeriksa pola rahasia dan kunci privat di skrip.
- [x] Log (`deploy.log`) hanya memuat id rilis, SHA, langkah, dan nama pengguna operator.
- [ ] `ADMIN_PASSWORD` dihapus dari `.env` setelah `AdminSeeder` dijalankan.

## CI dan rantai pasokan
- [x] Workflow CI hanya-baca (`permissions: contents: read`) dan tidak men-deploy.
- [x] `composer audit` dan `npm audit` di CI. Advisori Symfony yang ditemukan sudah diperbarui (audit bersih per 7 November 2026).
- [x] Dependabot mingguan untuk composer dan npm.
- [ ] Branch protection di GitHub: wajibkan job **CI lulus** dan tinjauan sebelum merge ke `main`. Pengaturan ini ada di GitHub, bukan di repositori.
- [ ] Pin aksi GitHub ke SHA commit (saat ini ke tag mayor `@v4`/`@v2`).
