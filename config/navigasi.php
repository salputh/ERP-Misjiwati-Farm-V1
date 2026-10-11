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
        ],
    ],
    'master' => [
        'label' => 'Master data',
        'fase' => null,
        'item' => [
            'standar-strain' => ['ikon' => 'uil-chart-line', 'label' => 'Standar strain', 'isi' => 'ABW, DG, pakan per umur'],
            'jenis-pakan' => ['ikon' => 'uil-tag-alt', 'label' => 'Jenis pakan', 'isi' => 'SB-10/11/12, Rp/kg, kg/zak'],
            'harga-kontrak' => ['ikon' => 'uil-pricetag-alt', 'label' => 'Harga kontrak', 'isi' => 'Bracket bobot min–maks ke Rp/kg'],
            'karyawan' => ['ikon' => 'uil-users-alt', 'label' => 'Karyawan', 'isi' => 'ABK, controller, kandang'],
            'pemodal' => ['ikon' => 'uil-briefcase-alt', 'label' => 'Pemodal', 'isi' => 'Porsi % per kandang'],
            'tarif-periode' => ['ikon' => 'uil-sliders-v-alt', 'label' => 'Tarif periode', 'isi' => 'Gaji/kg, premi, bonus %, zakat'],
        ],
    ],
];
