# System Requirement Specification — ERP Misjiwati Farm

Versi 0.1 (draft) · 16 Oktober 2026 · Basis analisis: workbook *Administrasi Harian Periode 18* (21 sheet)

## 1. Ringkasan

Dokumen ini menurunkan kebutuhan sistem ERP Misjiwati Farm dari seluruh isi workbook Periode 18. Workbook saat ini berfungsi sebagai aplikasi tersembunyi: ada sheet input (recording, sampling, nota panen, operasional), sheet kalkulasi (RHPP, FCR, IP), dan sheet laporan (dashboard, bagi hasil, slip gaji). ERP menggantikan semuanya dengan satu basis data, satu sumber kebenaran per angka, dan validasi input.

**Konteks bisnis (dari workbook):** Misjiwati Farm (K0242) adalah peternak plasma/mitra PT. Indojaya Agrinusa (Duri). Sapronak (DOC, pakan, OVK) disuplai inti; hasil panen dijual dengan harga kontrak P.17 berdasarkan bracket bobot; hasil akhir dihitung inti dalam RHPP. Di internal, hasil RHPP dibagi ke ABK, controller, dan pemodal per kandang. Satu periode = satu siklus pemeliharaan 2 kandang (K1 20.000 ekor, K2 25.000 ekor, chick-in 15 Jul 2026, panen 8–17 Agu 2026).

**Keterangan prioritas:** M = wajib (MVP), S = fase 2, C = opsional. Tag \[WB\] = ada di workbook, \[USUL\] = usulan baru dari analisis.

## 2. Hasil Analisis Workbook

### 2.1 Peta sheet ke modul ERP

| Sheet | Peran di workbook | Modul ERP |
| --- | --- | --- |
| Rocrding Kandang 1 / 2 | Buku harian per kandang: deplesi, pakan, bobot, FCR vs standar | M3 Recording Harian |
| Recording ALL | Gabungan 2 kandang (semua rumus) | Laporan turunan, tidak disimpan |
| Laporan harian | Dashboard + log pakan masuk, opname, jurnal pemberian pakan, pembagian pakan per kandang | M5 Pakan, M11 |
| Kalkulasi Sampel Harian | 11 blok timbang sampel (umur 13, 15, 20–28) | M4 Sampling |
| Rekap Panen | Nota timbang per mobil per kandang, tukang panen, upah | M6 Panen |
| Rekap Gabungan | Panen gabungan + FCR, deplesi, IP, umur panen tertimbang | M6, M11 |
| Harga Kontrak | Tabel 16 bracket bobot ke harga/kg (P.17) | M7 (master) |
| Simulasi RHPP / Simulasi RHPP Kandang | Proyeksi penjualan, sapronak, laba (total & per kandang) | M7 |
| RHPP Real | RHPP resmi inti (input), alokasi per kandang, banding harga kontrak vs real per nota | M7 |
| Performa Peternakan | Ringkasan periode untuk pemilik | M11 |
| Bagi Hasil K1 / K2 | Pembagian hasil ke ABK, controller, zakat, pemodal | M8 |
| Slip Gaji ABK | Rekap + slip individu (±14 blok salinan) | M10 |
| Operasional K1 / K2 | Dana masuk, buku besar biaya, ringkasan kategori | M9 |
| Daftar Rumus, Penjelasan Laporan Harian, Penjelasan Sampel Bobot, Analogi Sistem Web | Dokumentasi | Sumber requirement ini |

### 2.2 Alur data (6 jalur)

1. **Populasi & deplesi:** mati/afkir harian → deplesi kumulatif → saldo ayam.
2. **Bobot:** sampling → ABW → kembali ke kolom ABW aktual → DG dan FCR aktual.
3. **Pakan:** pakan masuk → jurnal pemberian harian → rekap per jenis/kandang → opname stok.
4. **Panen:** nota timbang → gabungan → ekor terpanen, bobot, ABW panen.
5. **Harga & hasil usaha:** bracket kontrak → nilai penjualan → dikurangi sapronak → RHPP.
6. **Distribusi hasil:** RHPP per kandang → bagi hasil → slip gaji, dikurangi biaya operasional.

Kunci penghubung seluruh sheet adalah **tanggal** (INDEX/MATCH). Di ERP, kunci ini diganti relasi periode–kandang–tanggal.

### 2.3 Angka acuan Periode 18 (dipakai untuk UAT)

| Indikator | Nilai |
| --- | --- |
| DOC masuk | 45.000 ekor (K1 20.000, K2 25.000), 37 g/ekor |
| Panen | 44.078 ekor, 79.821,2 kg, 53 nota (K1 23 nota/19.704 ekor/32.871,93 kg; K2 30 nota/24.374 ekor/46.949,27 kg) |
| ABW panen | 1,8109 kg |
| Pakan terpakai | 2.238 zak × 50 kg = 111.900 kg (SB-10 270, SB-11 990, SB-12 978 zak) |
| FCR | 1,4019 (standar RHPP 1,487) |
| Umur panen rata-rata tertimbang | 30,09 hari |
| IP | 420,55 (basis ekor terpanen) |
| Penjualan (simulasi, bracket + Rp500) | Rp1.757.980.710 |
| Penjualan (RHPP real) | Rp1.760.821.618 |
| Sapronak (RHPP real) | DOC Rp423.675.000 + pakan Rp1.113.204.000 + OVK Rp3.297.000 = Rp1.540.176.000 |
| Pendapatan bersih RHPP | Rp342.129.264 (K1 Rp140.895.518; K2 Rp201.233.746) |

### 2.4 Temuan masalah yang harus diselesaikan ERP

| # | Temuan | Dampak | Kebutuhan ERP |
| --- | --- | --- | --- |
| T1 | Sheet *Pakan* (ledger pembelian) dirujuk dokumentasi tetapi tidak ada di file; 13 sel #REF! di Performa Peternakan (6) dan Simulasi RHPP (7); harga pakan di Simulasi RHPP Kandang bernilai 0 | Biaya pakan, laba, dan IP versi simulasi tidak bisa dihitung | Modul pembelian/harga pakan sebagai master + transaksi |
| T2 | Pakan dicatat dua kali: kolom aktual di Recording (K1 914 + K2 1.274 = 2.188 zak) vs jurnal di Laporan harian (933 + 1.305 = 2.238 zak) | Selisih 50 zak, FCR bergantung sumber mana yang dipakai | Satu transaksi pemberian pakan, Recording membaca darinya |
| T3 | Deplesi dua definisi: workbook 2,28% (1.025 mati+afkir) vs RHPP resmi 2,05% ((DOC − panen) ÷ DOC = 922 ekor); selisih 103 ekor = kelebihan isi box DOC | Laporan internal dan RHPP tidak cocok | Simpan kedua metrik, beri label jelas, catat "bonus DOC" sebagai field |
| T4 | OVK: Simulasi RHPP Rp4.000.000 (input manual) vs RHPP Real Rp3.297.000 | Laba simulasi berbeda dari realisasi | Simulasi dan realisasi disimpan terpisah, selisih ditampilkan |
| T5 | Biaya operasional di Bagi Hasil diketik manual: K1 Rp75.995.246 vs sheet Operasional Rp74.815.246; K2 Rp59.944.239 vs Rp54.287.239 | Bagi hasil tidak terhubung ke buku besar | Bagi hasil menarik total operasional dari modul M9 secara otomatis |
| T6 | Alokasi sapronak per kandang di RHPP Real memakai share tonase (41,18% / 58,82%), sedangkan Simulasi RHPP Kandang memakai data aktual per kandang | Dua metode alokasi, hasil per kandang berbeda | Aturan alokasi eksplisit dan dapat dipilih per komponen biaya |
| T7 | Kategori biaya tidak seragam (Pembayaran PLN vs PLN & Kelistrikan; Pinjaman Karyawan vs Pinjaman ABK; Starlink hanya K1; Lain-lain hanya K2); judul sheet Operasional Kandang 1 tertulis "KANDANG 2" | Rekap lintas kandang tidak bisa dibandingkan | Master kategori biaya tunggal |
| T8 | Slip gaji = ±14 blok salinan manual; hari kerja, gaji panen, potongan lain diketik tangan | Rawan salah, tidak ada riwayat | Slip dibuat otomatis dari data payroll |
| T9 | Tanggal chick-in dan populasi ada di 4 tempat (Recording 1/2/ALL, Rekap Gabungan B86 bertanda "mohon dikonfirmasi") | Risiko parameter tidak sinkron | Satu parameter di data periode–kandang |
| T10 | Blok sampling: jumlah ekor per titik berbeda antar blok (20/16/10/8), sebagian ringkasan di-hardcode (mis. jumlah line K1 = 10) | ABW sampling bisa salah tanpa terlihat | Jumlah ekor per titik menjadi field di tiap sesi sampling |
| T11 | Nota panen yang muatannya berasal dari dua kandang (BTPA 016354, 016358, 016359, 016374) dipecah manual per krat/ekor | Rawan selisih bobot | Merge otomatis per No. BTPA dan halaman Split dengan alokasi proporsional tercatat |
| T12 | Harga real per nota di RHPP (rata-rata Rp22.059,57/kg) berbeda dari bracket + Rp500 (Rp22.023,98/kg) | Selisih Rp535,59/kg vs bracket murni | Banding harga kontrak vs real per nota sebagai laporan standar |
| T13 | Nama sheet typo ("Rocrding"), tabel standar disalin per kandang, rumus kumulatif dengan range tetap yang pernah terputus | Pemeliharaan sulit | Master standar tunggal per strain |

## 3. Aktor dan Hak Akses

| Peran | Tugas utama |
| --- | --- |
| Pemilik / manajer farm | Seluruh data, laporan keuangan, bagi hasil, persetujuan |
| Controller kandang | Input harian, sampling, pakan, panen, operasional kandangnya |
| Ketua ABK / ABK | Input harian terbatas (mati, afkir, pakan), lihat slip sendiri |
| Admin / keuangan | Dana operasional, payroll, RHPP |
| Pemodal | Lihat bagi hasil kandang miliknya (read-only) \[USUL\] |
| Pihak inti (PPL / PNBG) | Tidak login; namanya dicatat sebagai referensi nota dan entertain |

## 4. Kebutuhan Fungsional

### M1 Master Data dan Konfigurasi

- FR-101 (M) \[WB\] Master farm, kandang (lantai bawah/atas), strain, dan **tabel standar per umur** (deplesi kumulatif %, pakan gr/ekor, ABW, DG, FCR) yang dipakai semua periode.
- FR-102 (M) \[WB\] Master jenis pakan (SB-10, SB-11, SB-12) dengan berat per zak (50 kg) dan harga per kg yang berlaku.
- FR-103 (M) \[WB\] Master **tabel harga kontrak** (bracket BW min–max ke harga/kg) dengan versi dan masa berlaku (saat ini kontrak P.17, 16 bracket), plus penyesuaian harga (Rp500/kg) dan tarif insentif efisiensi (Rp260/kg) sebagai parameter periode.
- FR-104 (M) \[WB\] Master pembeli/ekspedisi, tukang panen, kategori biaya, jabatan.
- FR-105 (S) \[USUL\] Parameter bagi hasil (persentase, tarif) sebagai konfigurasi per kandang per periode, bukan rumus.

### M2 Periode dan Kandang

- FR-201 (M) \[WB\] Membuat periode (nomor siklus, inti, PPL) dengan dua atau lebih kandang; tiap kandang punya populasi DOC, tanggal chick-in, berat DOC, harga DOC.
- FR-202 (M) \[WB\] Mencatat kelebihan isi box DOC (bonus) sebagai populasi aktual terpisah dari populasi administratif.
- FR-203 (M) \[USUL\] Status periode (persiapan, berjalan, panen, tutup RHPP); data periode tertutup terkunci.
- FR-204 (S) \[USUL\] Salin pengaturan dari periode sebelumnya.

* FR-205 (M) \[USUL\] Alur utama: **Kandang adalah pintu masuk** sistem; pemilih periode (default periode aktif) selalu tampil di header dan menentukan data yang dilihat. Kandang × periode (house\_cycle) menjadi kunci semua transaksi.
* FR-206 (M) \[USUL\] Kartu "Farm / Gabungan" di samping daftar kandang untuk data level periode: RHPP resmi inti, stok gudang, biaya bersama, dan ringkasan gabungan seluruh kandang.
* FR-207 (S) \[USUL\] Periode lama tetap bisa dibuka (baca-saja) dan dibandingkan untuk satu kandang yang sama.

### M3 Recording Harian

- FR-301 (M) \[WB\] Input per kandang per hari umur: mati, afkir, ABW aktual (dari sampling), dan bobot standar otomatis dari master.
- FR-302 (M) \[WB\] Hitung otomatis: tanggal = chick-in + umur, deplesi kumulatif (ekor dan %), saldo ayam, pakan standar (gr/ekor × saldo ÷ 1000 ÷ 50 zak), pakan aktual gr/ekor, DG, persentase pakan vs BW, FCR standar vs aktual, selisih.
- FR-303 (M) \[WB\] Kolom panen per hari terisi otomatis dari nota panen (bukan ketik).
- FR-304 (M) \[WB\] Tampilan gabungan seluruh kandang (pengganti Recording ALL) berupa query, bukan data tersimpan.
- FR-305 (M) \[USUL\] Validasi: tidak boleh melewati populasi, tidak boleh ada tanggal ganda, peringatan mati harian melebihi ambang.
- FR-306 (S) \[USUL\] Input via HP dengan antrean offline (konektivitas lokasi bergantung Starlink).

* FR-307 (M) \[USUL\] Recording Gabungan = **merge otomatis** dua recording kandang: mati, afkir, pakan, dan saldo dijumlahkan; ABW gabungan dihitung tertimbang saldo ayam (bukan rata-rata sederhana seperti di workbook); FCR dan IP dihitung dari total.
* FR-308 (S) \[USUL\] **Split** data level farm (pakan masuk gudang, OVK, biaya bersama) ke kandang dengan aturan alokasi yang dipilih (populasi, tonase, atau konsumsi aktual).

### M4 Sampling Bobot

- FR-401 (M) \[WB\] Sesi sampling per kandang per tanggal: line per lantai dan jenis kelamin, Sampel 1 dan 2 (gram), jumlah ekor per titik.
- FR-402 (M) \[WB\] Hitung: total line, subtotal kelompok, titik sampel (line × 2), total ekor tersampel, ABW = total berat ÷ total ekor, DG aktual = selisih ABW sesi sebelumnya, selisih terhadap standar.
- FR-403 (M) \[WB\] Hasil ABW otomatis mengisi ABW aktual di Recording (menggantikan jalur umpan balik manual).
- FR-404 (S) \[WB\] Ringkasan gabungan antar kandang dan perbandingan pakan standar vs aktual pada tanggal sesi.
- FR-405 (S) \[USUL\] DG dinormalisasi per hari bila jarak antar sesi lebih dari 1 hari (catatan workbook: DG akhir tampak besar karena selisih beberapa hari).

### M5 Pakan dan Stok

- FR-501 (M) \[WB\] Log pakan masuk (tanggal, jenis, zak), kini dapat dikaitkan ke dokumen pembelian dan harga.
- FR-502 (M) \[WB\] Jurnal pemberian pakan harian per kandang: umur, jenis, jam (boleh banyak jam), jumlah zak. **Sumber tunggal** untuk FCR (menyelesaikan T2).
- FR-503 (M) \[WB\] Pembagian pakan gudang ke kandang per tanggal dan jenis; hitung sisa fisik di kandang.
- FR-504 (M) \[WB\] Neraca stok per jenis: masuk, terpakai (s/d tanggal), sisa; opname fisik dan selisih. Kolom "terpakai hari ini" otomatis (di workbook masih manual).
- FR-505 (M) \[WB\] Ledger pembelian pakan, rata-rata tertimbang harga, konversi zak ke kg dan nilai rupiah (menyelesaikan T1).
- FR-506 (S) \[USUL\] Peringatan stok minimum dan estimasi hari tersisa berdasarkan pakan standar.

### M6 Panen dan Nota Timbang

- FR-601 (M) \[WB\] Input nota per mobil: No. SPA, No. BTPA, No. polisi, pembeli/ekspedisi, waktu mulai/selesai, jumlah krat, ekor, berat kotor, netto nota, selisih, tukang panen, keterangan.
- FR-602 (M) \[WB\] Hitung ABW nota (berat ÷ ekor), rata-rata per krat, subtotal per hari dan per kandang, total seluruh panen.
- FR-603 (M) \[WB\] **Split nota** dan merge nota: nota dicatat per kandang (administrasi peternak); nota dengan No. BTPA yang sama di dua kandang otomatis digabung menjadi satu baris di administrasi inti. Halaman Split memecahnya kembali per kandang, dengan total alokasi terkunci sama dengan nota asli (menyelesaikan T11).
- FR-604 (M) \[WB\] Umur panen tiap nota = tanggal mulai − chick-in; umur rata-rata tertimbang ekor (SUMPRODUCT di workbook).
- FR-605 (S) \[WB\] Upah tukang panen per nota (terlihat tarif Rp20/kg pada sebagian nota) dan rekap per orang.
- FR-606 (S) \[USUL\] Pencatatan identitas timbangan dan penanggung jawab per periode.

* FR-607 (M) \[USUL\] Panen dicatat dari menu kandang masing-masing, karena administrasi peternak terpisah per kandang; administrasi inti (PT. Indojaya) menerima versi gabungan.
* FR-608 (M) \[USUL\] **Halaman Split nota:** pilih nota gabungan, tentukan range krat per kandang; krat campur dibagi proporsional per ekor (aturan seperti BTPA 016374, krat 35 = 5 + 6 ekor). Total ekor, krat, dan kg per kandang dikunci sama dengan nota asli, dan setiap split tercatat di riwayat.
* FR-609 (M) \[USUL\] Dua mode laporan panen dari data yang sama: per kandang (administrasi peternak) dan gabungan (administrasi inti).

### M7 Harga Kontrak dan RHPP

- FR-701 (M) \[WB\] Harga/kg per nota = bracket (berdasarkan ABW nota) + penyesuaian; nilai penjualan = berat × harga.
- FR-702 (M) \[WB\] **Simulasi RHPP:** penjualan − (DOC + pakan + OVK) = laba kotor; plus bonus efisiensi; hasilkan laba per ekor, laba per kg, HPP, margin. Dapat dihitung kapan saja sebelum RHPP resmi terbit.
- FR-703 (M) \[WB\] **RHPP Real:** input dokumen resmi inti (sapronak, harga real per nota, prestasi/efisiensi, subsidi harga pasar), hitung selisih hasil budidaya dan pendapatan bersih.
- FR-704 (M) \[WB\] Alokasi hasil per kandang dengan aturan yang bisa dipilih (tonase, populasi, konsumsi aktual) per komponen (menyelesaikan T6).
- FR-705 (S) \[WB\] Laporan banding harga kontrak vs real per nota dan alokasi subsidi pasar proporsional tonase.
- FR-706 (S) \[USUL\] Simulasi "what-if" (ubah FCR, harga, umur panen) tanpa mengubah data realisasi.

### M8 Bagi Hasil

- FR-801 (M) \[WB\] Per kandang: pendapatan = hasil budidaya + selisih efisiensi (Rp/kg × kg terjual) + bonus pasar; pengeluaran = operasional (otomatis dari M9), gaji ABK (Rp500/kg terjual), premi pemeliharaan, premi controller, upah controller (3% × pendapatan), bonus pasar ABK (30%) dan controller (10%), premi tetap ketua ABK.
- FR-802 (M) \[WB\] Entertain (inti), zakat penghasilan 2,5% dari sisa, lalu pembagian akhir ke pemodal berdasarkan persentase (kepemilikan bisa 1 atau lebih per kandang).
- FR-803 (M) \[WB\] Pembagian pendapatan ABK per orang (rata atau dengan premi tetap).
- FR-804 (S) \[USUL\] Semua persentase dan tarif dibaca dari parameter FR-105; hasil bisa dibekukan (snapshot) saat disetujui.

### M9 Operasional dan Dana

- FR-901 (M) \[WB\] Riwayat dana operasional masuk (tanggal, jumlah, saldo berjalan).
- FR-902 (M) \[WB\] Buku besar biaya: tanggal, kategori, uraian, jumlah item, nominal, per kandang; lampiran nota \[USUL\].
- FR-903 (M) \[WB\] Ringkasan: dana masuk, dana keluar, selisih dana, dan **total operasional = total biaya − pinjaman makan − pinjaman karyawan/ABK**.
- FR-904 (M) \[WB\] Pinjaman karyawan dan pinjaman makan tercatat per nama dan otomatis menjadi potongan di payroll (M10).
- FR-905 (S) \[USUL\] Anggaran per kategori vs realisasi dan pembanding antar periode.

### M10 SDM, Payroll, dan Slip Gaji

- FR-1001 (M) \[WB\] Master karyawan (ABK, ketua ABK, controller) dan penugasan per periode per kandang.
- FR-1002 (M) \[WB\] Komponen pendapatan: bagi hasil, bonus pasar, premi pemeliharaan, premi tetap, gaji/premi panen, premi pasang geomembran, penghasilan kotoran, gaji pokok.
- FR-1003 (M) \[WB\] Potongan: uang makan (tarif/hari × hari kerja; saat ini Rp35.000), pinjaman (dari M9), potongan lain berketerangan.
- FR-1004 (M) \[WB\] Slip gaji individu dibuat otomatis, dapat dicetak/PDF, per periode panen.
- FR-1005 (S) \[USUL\] Hari kerja dihitung dari absensi, bukan diketik.

### M11 Dashboard dan Laporan

- FR-1101 (M) \[WB\] Laporan harian: usia, pakan masuk/terpakai/sisa per jenis, mortalitas harian & kumulatif, ekor terpanen, sisa ayam, ABW dan bobot terpanen. Tanggal laporan bisa dipilih (pengganti sel kendali D7).
- FR-1102 (M) \[WB\] Performa peternakan per periode: panen, harga rata-rata tertimbang, sapronak, FCR, deplesi, umur panen, IP, hasil usaha.
- FR-1103 (M) \[WB\] Indikator: FCR, IP = (% hidup × BW) ÷ (FCR × umur) × 100 (kedua basis: ekor terpanen dan populasi hidup).
- FR-1104 (S) \[USUL\] Perbandingan antar kandang dan antar periode; ekspor Excel/PDF.
- FR-1105 (C) \[USUL\] Grafik kurva ABW dan FCR aktual vs standar.

* FR-1106 (M) \[USUL\] Setiap laporan punya dua mode cetak/ekspor: Administrasi Peternak (per kandang) dan Administrasi Inti (gabungan).

### M12 Administrasi Sistem

- FR-1201 (M) \[USUL\] Autentikasi, peran (RBAC), log audit (siapa mengubah apa), terutama untuk data keuangan.
- FR-1202 (M) \[USUL\] Impor data awal dari workbook Periode 18 (lihat bagian 8).
- FR-1203 (S) \[USUL\] Backup terjadwal dan pemulihan.

## 5. Aturan Bisnis dan Rumus Inti

| Kode | Aturan | Rumus |
| --- | --- | --- |
| BR-1 | Deplesi kumulatif | Σ mati + Σ afkir sampai tanggal itu |
| BR-2 | Saldo ayam | Populasi − deplesi kumulatif (− ekor terpanen untuk sisa di kandang) |
| BR-3 | Pakan standar (zak) | gram/ekor standar × saldo ayam ÷ 1000 ÷ 50 |
| BR-4 | ABW sampling | Total berat ÷ (jumlah line × 2 × ekor per titik) |
| BR-5 | FCR | Total pakan (kg) ÷ total bobot panen (kg) |
| BR-6 | Deplesi RHPP | (DOC − ekor panen) ÷ DOC; deplesi internal = kematian ÷ DOC (keduanya ditampilkan) |
| BR-7 | Umur panen tertimbang | Σ(ekor nota × umur nota) ÷ Σ ekor nota |
| BR-8 | IP | (% hidup × BW rata-rata) ÷ (FCR × umur) × 100 |
| BR-9 | Harga/kg nota | Harga bracket menurut ABW nota + penyesuaian kontrak |
| BR-10 | Pendapatan bersih RHPP | Total panen − total sapronak + prestasi + subsidi harga pasar + pendapatan lain |
| BR-11 | Total operasional (untuk bagi hasil) | Total biaya − pinjaman makan − pinjaman karyawan |
| BR-12 | Upah controller | 3% × jumlah pendapatan + premi controller |
| BR-13 | Bonus pasar | 30% ABK, 10% controller dari total bonus pasar |
| BR-14 | Zakat | 2,5% × sisa setelah entertain |

Catatan: nilai persentase dan tarif di atas adalah nilai Periode 18 dan harus menjadi parameter (FR-105), bukan konstanta kode.

## 6. Model Data (entitas utama)

| Kelompok | Entitas |
| --- | --- |
| Master | farms, houses, strains, standards (per umur), feed\_types, price\_bracket\_sets + price\_brackets, buyers, expense\_categories, employees, investors |
| Periode | cycles, house\_cycles (populasi, chick-in, berat DOC, harga DOC, bonus DOC) |
| Harian | daily\_records (mati, afkir, ABW aktual) , feed\_usages (jurnal pemberian, per jam) |
| Pakan | feed\_receipts, feed\_purchases, feed\_distributions, feed\_stock\_counts (opname) |
| Sampling | weight\_samplings, weight\_sampling\_points |
| Panen | harvest\_tickets (satu baris per kandang per nota; kunci gabungan = No. BTPA), harvest\_split\_logs, harvester\_wages |
| RHPP | rhpp\_documents (simulasi/real), rhpp\_lines, rhpp\_house\_allocations |
| Keuangan | expense\_funds (dana masuk), expenses (buku besar), loans |
| Bagi hasil/SDM | profit\_share\_configs, profit\_share\_results, assignments, payroll\_items, payslips |
| Sistem | users, roles, audit\_logs |

Relasi inti: cycle → house\_cycles → (daily\_records, feed\_usages, weight\_samplings, harvest\_tickets, expenses). Tanggal tetap menjadi dimensi kunci laporan, tetapi bukan lagi kunci relasi antar tabel.

## 7. Kebutuhan Non-Fungsional

- **Teknologi:** Laravel + MySQL. Frontend: tanpa Vite; pilihan terbuka antara Blade + Livewire atau React dengan bundler lain (lihat pertanyaan terbuka).
- **Integritas:** semua angka turunan dihitung server, tidak ada total yang diketik; periode tertutup tidak bisa diubah tanpa jejak audit.
- **Akurasi:** presisi desimal untuk bobot (2 desimal kg) dan uang (integer rupiah atau decimal), dengan aturan pembulatan sama seperti workbook (ROUND pada nilai bagi hasil).
- **Kinerja:** laporan periode (±53 nota, ±50 hari × 2 kandang) tampil kurang dari 2 detik.
- **Ketersediaan di lapangan:** UI responsif untuk HP; input harian tetap bisa dilakukan saat koneksi terputus (fase 2).
- **Keamanan:** hak akses per peran; data bagi hasil dan slip gaji hanya untuk peran berwenang; backup harian.
- **Bahasa:** antarmuka bahasa Indonesia; format tanggal dan rupiah lokal.
- **Kemudahan pakai:** form input meniru urutan kolom di workbook agar transisi tidak membingungkan operator.

## 8. Migrasi dari Excel

1. Impor master: standar per umur (dari Recording), harga kontrak, jenis pakan, kategori biaya (setelah diseragamkan T7), karyawan.
2. Impor transaksi Periode 18: mati/afkir harian, jurnal pakan, pakan masuk dan pembagian, sesi sampling, nota panen (termasuk split), operasional K1 (160 baris) dan K2 (116 baris), pinjaman.
3. Impor dokumen RHPP Real sebagai data input; hitung ulang semua nilai turunan.
4. Rekonsiliasi: bandingkan hasil ERP dengan angka acuan bagian 2.3; selisih T2–T6 diselesaikan dulu dengan keputusan pemilik sebelum data dianggap final.

## 9. Usulan Fase Rilis

| Fase | Isi | Alasan |
| --- | --- | --- |
| 1 (MVP) | M1, M2, M3, M5, M6 + laporan harian dan FCR/IP | Alur harian dan panen sudah menjadi sumber seluruh angka lain |
| 2 | M4 Sampling, M7 RHPP, M9 Operasional | Menutup siklus biaya dan hasil usaha |
| 3 | M8 Bagi Hasil, M10 Payroll/slip, dashboard lanjutan, offline | Bergantung pada data M7 dan M9 yang sudah bersih |

## 10. Kriteria Penerimaan (UAT)

- Total panen, bobot, ABW, FCR, umur panen tertimbang, dan IP sama dengan tabel 2.3 setelah impor Periode 18.
- Pakan terpakai konsisten di satu angka (2.238 zak atau 2.188 zak, sesuai keputusan T2) pada Recording, Laporan harian, FCR, dan RHPP.
- Pendapatan bersih RHPP Real = Rp342.129.264 dan jumlah per kandang = total.
- Total operasional di Bagi Hasil sama dengan total di buku besar M9 untuk kandang yang sama.
- Total slip gaji per kandang sama dengan total pendapatan ABK di Bagi Hasil.
- Sistem tidak menghasilkan error (#REF!) atau nilai kosong untuk biaya pakan karena master harga hilang.

## 11. Pertanyaan Terbuka

1. Apakah sheet *Pakan* (ledger pembelian) pernah ada dan mau dihidupkan, atau harga pakan cukup dari master/RHPP? *cukup dari master*
2. Pakan terpakai resmi yang mana: 2.238 zak (jurnal) atau 2.188 zak (Recording)? Perlu ditelusuri 50 zak selisih.
3. Untuk laporan internal, deplesi memakai definisi 2,28% atau 2,05% (RHPP)? Usulan: tampilkan keduanya.
4. Aturan alokasi biaya bersama (OVK, pakan, DOC) ke kandang: tonase, populasi, atau konsumsi aktual?
5. Apakah skema bagi hasil (persentase, premi, pemodal) berubah tiap periode atau tetap?
6. Apakah farm akan bertambah (lebih dari satu farm/inti) sehingga perlu multi-tenant sejak awal? (Kemungkinan besar akan bertambah farm nya)

