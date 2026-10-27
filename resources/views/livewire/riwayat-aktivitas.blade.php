<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Riwayat aktivitas" :jejak="['Aktivitas']" />

        @if ($this->adaAktivitas)
            <x-aktivitas.riwayat
                :per-hari="$this->perHari"
                :dimuat="$this->daftar->count()"
                :total="$this->total"
                :jenis="$this->saringanJenis"
                :modul="$this->saringanModul"
            />
        @else
            <x-kosong judul="Belum ada aktivitas">Riwayat ini mencatat setiap data yang ditambah, diubah, atau dihapus lewat aplikasi. Catatan pertama muncul setelah laporan harian atau sampling bobot disimpan.</x-kosong>
        @endif
    </div>

    <x-memuat target="pilihJenis, pilihModul, muatLagi" teks="Memuat riwayat aktivitas" cepat />
</div>
