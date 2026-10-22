<div class="crm mb-25">
    <div class="container-fluid">
        <div class="row">
            <x-breadcrumb judul="Ringkasan" />

            @if ($this->periode)
                <div class="col-xxl-6">
                    <div class="row h-100">
                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['sisa'])" label="Ayam hidup" ikon="uil-layer-group" warna="primary">
                            <small>dari @angka($this->total['awal']) ekor chick-in, dikurangi @angka($this->total['terpanen']) ekor panen</small>
                        </x-dashboard.kartu>

                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['mortalitas'], 2).'%'" label="Mortalitas kumulatif" ikon="uil-heart-break" warna="info">
                            <small>@angka($this->total['mati']) mati, @angka($this->total['afkir']) afkir</small>
                        </x-dashboard.kartu>

                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['abw']).' g'" label="Bobot rata-rata" ikon="uil-weight" warna="secondary">
                            @isset($this->total['abw_selisih'])
                                <x-selisih :nilai="$this->total['abw_selisih']" />
                                <small>{{ $this->total['abw_selisih'] >= 0 ? 'di atas' : 'di bawah' }} standar</small>
                            @else
                                <small>Belum ada data timbang</small>
                            @endisset
                        </x-dashboard.kartu>

                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['fcr'], 2)" label="FCR sementara" ikon="uil-balance-scale" warna="warning">
                            <small>@angka($this->total['pakan_kg']) kg pakan terpakai</small>
                        </x-dashboard.kartu>
                    </div>
                </div>

                <x-dashboard.bobot-standar :grafik="$this->grafik" />
                <x-dashboard.harian :grafik="$this->grafik" />
                <x-dashboard.performa-kandang :kandang="$this->kandang" />
                <x-dashboard.aktivitas :daftar="$this->aktivitasTerbaru" />

                <div class="col-lg-12">
                    <p class="fs-12 color-gray mb-0">Data dan standar berasal dari lembar recording. Ambang status bobot (di bawah 3% dan 8% dari standar) masih nilai sementara sampai dikonfirmasi.</p>
                </div>
            @else
                <div class="col-lg-12 mb-25">
                    <div class="card border-0">
                        <div class="card-body p-30">
                            <h5 class="mb-10">Belum ada periode</h5>
                            <p class="color-gray mb-0">Ringkasan menampilkan performa tiap kandang selama periode berjalan. Data muncul setelah periode pertama dibuat dan recording harian diisi.</p>
                        </div>
                    </div>
                </div>
            @endif
        </div>
    </div>
</div>
