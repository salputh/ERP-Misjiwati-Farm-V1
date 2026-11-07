<div class="crm mb-4" x-data="masukBerurutan">
    <div class="container-fluid">
        <div class="row">
            <x-breadcrumb judul="Ringkasan" />

            @if ($this->periode)
                <div class="col-xxl-6">
                    <div class="row h-100">
                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->waktu['umur']).' hari'" label="Umur ayam" ikon="bi-calendar3" warna="success">
                            @if ($this->waktu['umur_selesai'])
                                <small>saat panen terakhir {{ $this->waktu['panen_terakhir']->translatedFormat('j F Y') }}</small>
                            @else
                                <small>sejak chick-in DOC {{ $this->waktu['chick_in']->translatedFormat('j F Y') }}</small>
                            @endif
                        </x-dashboard.kartu>

                        <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->waktu['hari_kerja']).' hari'" label="Total hari kerja" ikon="bi-clock" warna="danger">
                            @if ($this->waktu['kerja_selesai'])
                                <small>chick-in sampai panen terakhir, periode ditutup</small>
                            @else
                                <small>termasuk hari chick-in {{ $this->waktu['chick_in']->translatedFormat('j F Y') }}</small>
                            @endif
                        </x-dashboard.kartu>

                        @if ($this->real)
                            {{-- RHPP real sudah dikunci: angka ayam diambil dari dokumen RHPP inti. --}}
                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->real['ekor'])" label="Ayam hidup (RHPP real)" ikon="bi-layers" warna="primary">
                                <small>ekor terpanen dari @angka($this->real['doc']) DOC</small>
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->real['deplesi'], 2).'%'" label="Mortalitas kumulatif (RHPP real)" ikon="bi-heartbreak" warna="info">
                                <small>deplesi, standar @angka($this->real['deplesi_standar'], 2)%</small>
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->real['bw_gram']).' g'" label="Bobot rata-rata (RHPP real)" ikon="bi-speedometer2" warna="secondary">
                                <small>BW panen, umur rata-rata @angka($this->real['umur_rata'], 1) hari</small>
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->real['fcr'], 3)" label="FCR (RHPP real)" ikon="bi-calculator" warna="warning">
                                <small>standar @angka($this->real['fcr_standar'], 3)</small>
                            </x-dashboard.kartu>
                        @else
                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['sisa'])" label="Ayam hidup" ikon="bi-layers" warna="primary">
                                <small>dari @angka($this->total['awal']) ekor chick-in, dikurangi @angka($this->total['terpanen']) ekor panen</small>
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['mortalitas'], 2).'%'" label="Mortalitas kumulatif" ikon="bi-heartbreak" warna="info">
                                <small>@angka($this->total['mati']) mati, @angka($this->total['afkir']) afkir</small>
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['abw']).' g'" label="Bobot rata-rata" ikon="bi-speedometer2" warna="secondary">
                                @isset($this->total['abw_selisih'])
                                    <x-selisih :nilai="$this->total['abw_selisih']" />
                                    <small>{{ $this->total['abw_selisih'] >= 0 ? 'di atas' : 'di bawah' }} standar</small>
                                @else
                                    <small>Belum ada data timbang</small>
                                @endisset
                            </x-dashboard.kartu>

                            <x-dashboard.kartu :nilai="\App\Support\Format::angka($this->total['fcr'], 2)" label="FCR sementara" ikon="bi-calculator" warna="warning">
                                <small>@angka($this->total['pakan_kg']) kg pakan terpakai</small>
                            </x-dashboard.kartu>
                        @endif
                    </div>
                </div>

                <x-dashboard.bobot-standar :grafik="$this->grafik" />
                <x-dashboard.harian :grafik="$this->grafik" />
                <x-dashboard.performa-kandang :kandang="$this->kandang" />
                <x-dashboard.aktivitas :daftar="$this->aktivitasTerbaru" />

                <div class="col-lg-12">
                    <p class="small text-body-secondary mb-0">Data dan standar berasal dari lembar recording. Ambang status bobot (di bawah 3% dan 8% dari standar) masih nilai sementara sampai dikonfirmasi.</p>
                </div>
            @else
                <x-kosong judul="Belum ada periode">Ringkasan menampilkan performa tiap kandang selama periode berjalan. Data muncul setelah periode pertama dibuat dan recording harian diisi.</x-kosong>
            @endif
        </div>
    </div>
</div>
