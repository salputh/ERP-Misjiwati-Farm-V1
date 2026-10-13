<?php

// Sumber tunggal navigasi sidebar dan halaman modul yang belum dibuat.
// Urutan grup mengikuti frekuensi pakai pemilik; isi item dari model data.
// Tiap grup tampil sebagai judul bagian; semua itemnya langsung terlihat.
// Item dengan 'per_kandang' (nama rute berparameter kandang) tampil sebagai dropdown berisi satu tautan per kandang.
return [
    'periode' => [
        'label' => 'Periode',
        'fase' => null,
        'item' => [
            'periode' => ['ikon' => 'uil-calendar-alt', 'label' => 'Periode', 'isi' => 'Chick-in, DOC, status'],
            'kandang' => ['ikon' => 'uil-home', 'label' => 'Kandang', 'isi' => 'Populasi, controller'],
        ],
    ],
    'produksi' => [
        'label' => 'Produksi',
        'fase' => 'fase 1–2',
        'item' => [
            'recording-harian' => ['ikon' => 'uil-clipboard-notes', 'label' => 'Recording harian', 'isi' => 'Tanggal, umur, mati, afkir, pakan (zak), catatan'],
            'laporan-harian' => ['ikon' => 'uil-file-alt', 'label' => 'Laporan harian', 'isi' => null],
            'pakan-dan-stok' => ['ikon' => 'uil-box', 'label' => 'Pakan dan stok', 'isi' => 'Penerimaan per jenis, distribusi ke kandang, pemberian, opname'],
            'sampling-bobot' => ['ikon' => 'uil-weight', 'label' => 'Sampling bobot', 'isi' => 'Sesi, lantai, kelamin, 2× timbang per line, ekor per titik, ABW'],
            'panen' => ['ikon' => 'uil-truck', 'label' => 'Panen', 'isi' => 'Nota SPA/BTPA, trip, pecahan per kandang, tim tangkap, upah'],
        ],
    ],
    'keuangan' => [
        'label' => 'Keuangan',
        'fase' => 'fase 3–4',
        'item' => [
            'rhpp' => ['ikon' => 'uil-invoice', 'label' => 'RHPP', 'isi' => 'Estimasi: bracket + adj. Real: harga per trip. Subsidi, efisiensi'],
            'kas-operasional' => ['ikon' => 'uil-wallet', 'label' => 'Kas operasional', 'isi' => 'Dana masuk, biaya per kategori, pinjaman karyawan', 'per_kandang' => 'kas.operasional'],
            'bagi-hasil' => ['ikon' => 'uil-percentage', 'label' => 'Bagi hasil', 'isi' => 'Potongan berurutan, tarif dari master, porsi pemodal', 'per_kandang' => 'bagi.hasil'],
            'payroll-abk' => ['ikon' => 'uil-money-bill', 'label' => 'Payroll ABK', 'isi' => 'Komponen pendapatan, uang makan, pinjaman, slip per orang'],
            'payroll-pemanen' => ['ikon' => 'uil-money-bill', 'label' => 'Payroll pemanen', 'isi' => 'Upah berdasarkan berat panen dan tarif per orang', 'rute' => 'payroll.pemanen'],
        ],
    ],
    'master' => [
        'label' => 'Master data',
        'fase' => null,
        'item' => [
            'master-data' => ['ikon' => 'uil-database', 'label' => 'Master data', 'isi' => 'Jenis pakan, harga kontrak, dan pemodal', 'rute' => 'master-data'],
            'standar-strain' => ['ikon' => 'uil-chart-line', 'label' => 'Standar strain', 'isi' => 'ABW, DG, pakan per umur'],
            'karyawan' => ['ikon' => 'uil-users-alt', 'label' => 'Karyawan', 'isi' => 'ABK, controller, kandang'],
            'tarif-periode' => ['ikon' => 'uil-sliders-v-alt', 'label' => 'Tarif periode', 'isi' => 'Gaji/kg, premi, bonus %, zakat'],
        ],
    ],
];
