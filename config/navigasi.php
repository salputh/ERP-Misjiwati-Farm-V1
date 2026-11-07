<?php

// Sumber tunggal navigasi sidebar dan halaman modul yang belum dibuat.
// Urutan grup mengikuti frekuensi pakai pemilik; isi item dari model data.
// Tiap grup tampil sebagai judul bagian; semua itemnya langsung terlihat.
// Item dengan 'per_kandang' (nama rute berparameter kandang) tampil sebagai dropdown berisi satu tautan per kandang.
// 'rute_aktif' adalah pola nama rute yang ikut menandai item aktif, misalnya halaman detail di bawahnya.
return [
    'periode' => [
        'label' => 'Periode',
        'fase' => null,
        'item' => [
            'periode' => ['ikon' => 'bi-calendar3', 'label' => 'Periode', 'isi' => 'Farm, kandang, chick-in, DOC, dan status periode', 'rute' => 'periode.index'],
        ],
    ],
    'produksi' => [
        'label' => 'Produksi',
        'fase' => 'fase 1–2',
        'item' => [
            'recording-harian' => ['ikon' => 'bi-clipboard-data', 'label' => 'Recording harian', 'isi' => 'Tanggal, umur, mati, afkir, pakan (zak), catatan'],
            'laporan-harian' => ['ikon' => 'bi-file-earmark-text', 'label' => 'Laporan harian', 'isi' => null],
            'pakan-dan-stok' => ['ikon' => 'bi-box-seam', 'label' => 'Pakan dan stok', 'isi' => 'Penerimaan per jenis, distribusi ke kandang, pemberian, opname'],
            'sampling-bobot' => ['ikon' => 'bi-speedometer2', 'label' => 'Sampling bobot', 'isi' => 'Sesi, lantai, kelamin, 2× timbang per line, ekor per titik, ABW'],
            'panen' => ['ikon' => 'bi-truck', 'label' => 'Panen', 'isi' => 'Nota SPA/BTPA, trip, pecahan per kandang, tim tangkap, upah'],
            'kohe' => ['ikon' => 'bi-bag', 'label' => 'Kohe', 'isi' => 'Stok karung kotoran hewan dan penjualannya'],
        ],
    ],
    'keuangan' => [
        'label' => 'Keuangan',
        'fase' => 'fase 3–4',
        'item' => [
            'rhpp' => ['ikon' => 'bi-receipt', 'label' => 'RHPP', 'isi' => 'Estimasi: bracket + adj. Real: harga per trip. Subsidi, efisiensi'],
            'kas-operasional' => ['ikon' => 'bi-wallet2', 'label' => 'Kas operasional', 'isi' => 'Dana masuk, biaya per kategori, pinjaman karyawan', 'per_kandang' => 'kas.operasional'],
            'bagi-hasil' => ['ikon' => 'bi-percent', 'label' => 'Bagi hasil', 'isi' => 'Potongan berurutan, tarif dari master, porsi pemodal', 'per_kandang' => 'bagi.hasil'],
            'payroll-abk' => ['ikon' => 'bi-cash-stack', 'label' => 'Payroll ABK', 'isi' => 'Komponen pendapatan, uang makan, pinjaman, slip per orang'],
            'kasbon-abk' => ['ikon' => 'bi-receipt-cutoff', 'label' => 'Kasbon ABK', 'isi' => 'Kasbon HP, motor, dan lainnya yang dicicil lewat potongan slip gaji', 'rute' => 'kasbon.abk'],
            'payroll-pemanen' => ['ikon' => 'bi-cash-stack', 'label' => 'Payroll pemanen', 'isi' => 'Upah berdasarkan berat panen dan tarif per orang', 'rute' => 'payroll.pemanen'],
        ],
    ],
    'project' => [
        'label' => 'Project',
        'fase' => null,
        'item' => [
            'project' => ['ikon' => 'bi-folder2-open', 'label' => 'Project', 'isi' => 'Project, anggota, tenggat, dan progres tugas', 'rute' => 'project.index', 'rute_aktif' => 'project.*'],
        ],
    ],
    'master' => [
        'label' => 'Master data',
        'fase' => null,
        'item' => [
            'master-data' => ['ikon' => 'bi-database', 'label' => 'Master data', 'isi' => 'Jenis pakan, harga kontrak, pemodal, tarif periode, dan premi ABK', 'rute' => 'master-data'],
            'standar-strain' => ['ikon' => 'bi-graph-up', 'label' => 'Standar strain', 'isi' => 'ABW, DG, pakan per umur', 'rute' => 'standar-strain'],
            'karyawan' => ['ikon' => 'bi-people', 'label' => 'Karyawan', 'isi' => 'ABK, controller, kandang'],
        ],
    ],
    'pengaturan' => [
        'label' => 'Pengaturan',
        'fase' => null,
        'item' => [
            'akun' => ['ikon' => 'bi-person-circle', 'label' => 'Akun pengguna', 'isi' => 'Akun untuk masuk ke ERP dan siapa yang sedang masuk', 'rute' => 'akun'],
        ],
    ],
];
