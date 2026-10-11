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
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada aktivitas</h5>
                        <p class="color-gray mb-0">Riwayat ini mencatat setiap data yang ditambah, diubah, atau dihapus lewat aplikasi. Catatan pertama muncul setelah laporan harian atau sampling bobot disimpan.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="pilihJenis, pilihModul, muatLagi" teks="Memuat riwayat aktivitas" cepat />
</div>
