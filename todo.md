# Todo deployment

Terakhir diperbarui: 7 November 2026.

## Selesai
- [x] Audit infrastruktur dan proyek, termasuk pemeriksaan baca-saja ke VPS (`docs/deployment/infrastructure-audit.md`).
- [x] Akses SSH sementara untuk audit dibuat, dicabut, dan diverifikasi. Daftar kunci sama seperti semula.
- [x] Commit pekerjaan: AdminSeeder, pembaruan Symfony + Larastan, UI Basalt + nomor siklus per kandang (branch `release/ui-basalt`, belum di-push).
- [x] 8 advisori keamanan Symfony diperbaiki. `composer audit` dan `npm audit` bersih.
- [x] Larastan terpasang (level 0 bersih).
- [x] Workflow CI dan Dependabot dibuat (`.github/`), belum pernah berjalan di GitHub.
- [x] `scripts/deploy.sh`, `scripts/rollback.sh`, `scripts/remote/release.sh`, `scripts/lib/common.sh`, `scripts/ssh-access.sh`, `scripts/server-setup.sh`.
- [x] ShellCheck bersih. 100 pemeriksaan sandbox lulus (dijalankan dua kali berturut-turut).
- [x] Dokumentasi: README, rollback guide, security checklist.

## Terhenti
- [ ] **GitHub Actions tidak bisa memulai job apa pun** (`startup_failure`, 0 detik, bahkan untuk workflow `echo ok` minimal). Penyebabnya bukan berkas CI: `actionlint` bersih. Periksa github.com/settings/billing (batas pengeluaran/menit Actions untuk repositori privat) dan tab Actions repositori. Tanpa CI hijau, `deploy.sh` menolak deploy (disengaja, tidak ada cara melewatinya).

## Persetujuan sudah diberikan (7 November 2026), menunggu langkah di atas

- [ ] Push `release/ui-basalt` dan buka PR ke `main`. Catatan: branch ini berisi 4 commit demo di bawahnya (DemoMode, DemoSeeder, dll.), yang akan ikut masuk ke `main` bila digabung.
- [ ] Aktifkan GitHub Actions dan branch protection (job **CI lulus**).
- [ ] Persetujuan menjalankan `server-setup.sh --apply` (folder rilis, `.env` disalin, sudoers terbatas, cron backup, kunci deploy). Mengubah server.
- [ ] Persetujuan deploy pertama (setelah CI hijau dan `plan` dibaca). Migrasi menghapus kolom `periodes.nomor_siklus`: backup dan persetujuan migrasi wajib.
- [ ] Persetujuan `switch-nginx` setelah deploy pertama sehat.

## Masalah yang belum selesai
- [ ] CI belum teruji di GitHub (hanya perintahnya yang dijalankan lokal). Kemungkinan perlu penyesuaian kecil pada run pertama.
- [ ] Transport SSH nyata, `sudo systemctl reload`, dan `composer install` di server belum teruji (tidak ada staging).
- [ ] Larastan baru di level 0. Level 1 memunculkan 410 temuan (kebanyakan properti Livewire); naikkan bertahap.
- [ ] Kunci root `claude-deploy-kayujati` (proyek lain) dan satu kunci tanpa nama: tentukan pemiliknya lewat `auth.log`, lalu cabut yang tidak dipakai.
- [ ] Hapus `/root/.ssh/authorized_keys.bak-audit-20261107` dan entri `safe.directory` di `/root/.gitconfig` yang tertinggal dari audit.
- [ ] Amankan SSH (matikan login root/sandi) setelah akses `deploy` berbasis kunci terbukti.
- [ ] Cabut sudo penuh akun `deploy` setelah semua deploy lain (demo) dipindah ke aturan terbatas.
- [ ] Reboot server dan pembaruan 14 paket.
- [ ] Salinan backup di luar server (rclone) dan uji pemulihan backup.
- [ ] Pindahkan database SQLite ke luar folder aplikasi (`/var/lib/erp-misjiwati/`), terpisah dari deploy ini.
- [ ] Pin aksi GitHub ke SHA.
- [ ] Hapus aset HexaDash lama (`public/assets/{css,js,img,fonts}`) dan katalog `/template` yang tidak dipakai lagi oleh UI Basalt.
