<div class="crm">
<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Laporan harian pemeliharaan ayam broiler" :jejak="['Produksi', 'Laporan harian']" />
        <x-periode-tertutup :periode="$this->periode" />

        @isset($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endisset

        @if ($this->laporan)
            {{-- Identitas laporan --}}
            <div class="col-12 mb-4">
                <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<label class="d-flex align-items-center gap-2 mb-0 fw-normal text-body-secondary tanpa-kapital">
                            Tanggal laporan
                            <x-pilih-tanggal
                                :nilai="$this->laporan['tanggal']->format('Y-m-d')"
                                :min="$this->periode->tanggal_chick_in->format('Y-m-d')"
                                :maks="$this->tanggalTerakhir->format('Y-m-d')"
                                x-on:tanggal-dipilih="window.location = '{{ route('laporan.harian', ['periode' => $this->periode->id]) }}&tanggal=' + $event.detail"
                            />
                        </label>
                        {{-- Tombol PNG melukis laporan ini dari data-lembar (Alpine eksporLaporan) --}}
                        <div class="d-flex flex-wrap align-items-center gap-2 d-flex flex-wrap gap-2 mt-0" x-data="eksporLaporan" data-lembar="{{ json_encode($this->lembar) }}">
                            <x-tombol warna="light" variasi="outlined" ikon="bi-image" x-on:click="simpan">Simpan PNG</x-tombol>
                            <x-tombol warna="light" variasi="outlined" ikon="bi-copy" x-on:click="salin"><b class="fw-medium" x-text="labelSalin" aria-live="polite">Salin PNG</b></x-tombol>
                            @unless ($this->periode->tertutup())
                                <a href="{{ route('laporan.harian.form', ['periode' => $this->periode->id, 'tanggal' => $this->laporan['tanggal']->format('Y-m-d')]) }}" class="btn btn-outline-primary text-primary btn-sm">Ubah laporan ini</a>
                                <x-tombol data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</x-tombol>
                            @endunless
                        </div>
</header>
                        <x-info>
                            <x-info.butir label="Peternak">Misjiwati</x-info.butir>
                            <x-info.butir label="Kandang">{{ collect($this->laporan['kandang'])->pluck('nama')->join(', ') }}</x-info.butir>
                            <x-info.butir label="Jumlah ayam">@angka($this->laporan['populasi']) ekor</x-info.butir>
                            <x-info.butir label="Tanggal laporan">{{ $this->laporan['tanggal']->translatedFormat('l, j F Y') }}</x-info.butir>
                            <x-info.butir label="Usia">{{ $this->laporan['umur'] }} hari</x-info.butir>
                            <x-info.butir label="Data terakhir">{{ $this->tanggalTerakhir->translatedFormat('j F Y') }}</x-info.butir>
                        </x-info>
                    
</div>
</section>
            </div>

            {{-- Angka utama hari ini --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['sisa'])" label="Sisa ayam di kandang" ikon="bi-layers" warna="primary">
                <small>dari @angka($this->laporan['total']['populasi']) ekor chick-in, dikurangi @angka($this->laporan['total']['terpanen']) ekor panen</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['mati_hari_ini'])" label="Kematian hari ini" ikon="bi-heartbreak" warna="info">
                <small>kumulatif @angka($this->laporan['total']['mati_kumulatif']) ekor (@angka($this->laporan['total']['mortalitas'], 2)%)</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['abw']).' g'" label="ABW" ikon="bi-speedometer2" warna="secondary">
                @if (count($this->laporan['kandang']) === 1 && isset($this->laporan['kandang'][0]['abw_selisih']))
                    <x-selisih :nilai="$this->laporan['kandang'][0]['abw_selisih']" />
                    <small>dari standar @angka($this->laporan['kandang'][0]['abw_standar']) g</small>
                @else
                    <small>rata-rata tertimbang jumlah ayam</small>
                @endif
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['fcr'], 3)" label="FCR" ikon="bi-calculator" warna="warning">
                @if (count($this->laporan['kandang']) === 1 && isset($this->laporan['kandang'][0]['fcr_standar']))
                    <small>standar @angka($this->laporan['kandang'][0]['fcr_standar'], 3)</small>
                @else
                    <small>pakan per ekor dibagi ABW</small>
                @endif
            </x-dashboard.kartu>

            {{-- Pakan masuk --}}
            <div class="col-xxl-5 mb-4">
                <section class="card basalt-box db-card h-100">
<div class="db-card-body db-card-body-table">
<header class="db-card-head">
<div><h2 class="db-card-title">Pakan masuk</h2></div>
</header>
                        <div class="selling-table-wrap">
                        <div class="table-responsive">
                            <table class="table tabel-laporan db-table">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Jenis</th>
                                        <th class="text-end">Zak</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->laporan['pakan_masuk'] as $masuk)
                                        <tr>
                                            <td>{{ $masuk['tanggal']->translatedFormat('j F Y') }}</td>
                                            <td>{{ $masuk['jenis'] }}</td>
                                            <td class="text-end">@angka($masuk['zak'])</td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="3" class="text-body-secondary">Belum ada pakan masuk yang dicatat sampai tanggal ini.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="2">Total pakan masuk</th>
                                        <th class="text-end">@angka($this->laporan['total_pakan_masuk']) zak</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        </div>
                    
</div>
</section>
            </div>

            {{-- Opname pakan, lalu mortalitas; ditumpuk agar tingginya sama dengan daftar pakan masuk --}}
            <div class="col-xxl-7 d-flex flex-column">
                <section class="card basalt-box db-card mb-4">
<div class="db-card-body db-card-body-table">
<header class="db-card-head">
<div><h2 class="db-card-title">Opname pakan</h2></div>
                        <div class="d-flex flex-wrap align-items-center gap-2 text-body-secondary tanpa-kapital">
                            @isset($this->laporan['hari_cukup'])
                                Sisa stok cukup sekitar @angka($this->laporan['hari_cukup'], 1) hari dengan pemakaian hari ini
                            @endisset
                        </div>
</header>
                        <div class="selling-table-wrap">
                        <div class="table-responsive">
                            <table class="table tabel-laporan db-table">
                                <thead>
                                    <tr>
                                        <th>Jenis</th>
                                        <th class="text-end">Masuk</th>
                                        <th class="text-end">Terpakai hari ini</th>
                                        <th class="text-end">Terpakai s/d hari ini</th>
                                        <th class="text-end">Sisa stok</th>
                                        <th>Pemakaian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($this->laporan['opname'] as $stok)
                                        <tr>
                                            <td><strong>{{ $stok['jenis'] }}</strong></td>
                                            <td class="text-end">@angka($stok['masuk'])</td>
                                            <td class="text-end">@angka($stok['terpakai_hari_ini'])</td>
                                            <td class="text-end">@angka($stok['terpakai'])</td>
                                            <td @class(['text-end', 'text-danger fw-semibold' => $stok['sisa'] < 0])>
                                                @isset($stok['sisa'])
                                                    @kurung($stok['sisa'])
                                                @else
                                                    -
                                                @endisset
                                            </td>
                                            <td class="tabel-laporan__batang">
                                                @isset($stok['persen_terpakai'])
                                                    <div class="d-flex align-items-center gap-2">
                                                        <div class="progress flex-grow-1" role="progressbar" aria-label="Pemakaian {{ $stok['jenis'] }}" aria-valuenow="{{ round($stok['persen_terpakai']) }}" aria-valuemin="0" aria-valuemax="100">
                                                            <div class="progress-bar bg-primary share-{{ max(0, min(100, (int) round($stok['persen_terpakai']))) }}"></div>
                                                        </div>
                                                        <span class="small text-body-secondary">@angka($stok['persen_terpakai'])%</span>
                                                    </div>
                                                @else
                                                    <span class="small text-body-secondary">Stok tidak dihitung</span>
                                                @endisset
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th>Total (zak)</th>
                                        <th class="text-end">@angka($this->laporan['total_opname']['masuk'])</th>
                                        <th class="text-end">@angka($this->laporan['total_opname']['terpakai_hari_ini'])</th>
                                        <th class="text-end">@angka($this->laporan['total_opname']['terpakai'])</th>
                                        <th @class(['text-end', 'text-danger' => $this->laporan['total_opname']['sisa'] < 0])>
                                            @isset($this->laporan['total_opname']['sisa'])
                                                @kurung($this->laporan['total_opname']['sisa'])
                                            @else
                                                -
                                            @endisset
                                        </th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        </div>
                    
</div>
</section>

                {{-- Mortalitas dan performa per kandang --}}
                <section class="card basalt-box db-card mb-4 flex-grow-1">
<div class="db-card-body db-card-body-table">
<header class="db-card-head">
<div><h2 class="db-card-title">Mortalitas dan performa</h2></div>
</header>
                        <div class="selling-table-wrap">
                        <div class="table-responsive">
                            <table class="table tabel-laporan text-nowrap db-table">
                                <thead>
                                    <tr>
                                        <th>Kandang</th>
                                        <th class="text-end">Kematian hari ini</th>
                                        <th class="text-end">Kumulatif kematian</th>
                                        <th class="text-end">Sisa ayam</th>
                                        <th class="text-end">ABW</th>
                                        <th class="text-end">FCR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($this->laporan['kandang'] as $kandang)
                                        <tr>
                                            <td>
                                                <strong>{{ $kandang['nama'] }}</strong>
                                                <span class="d-block small text-body-secondary">@angka($kandang['populasi']) ekor chick-in</span>
                                            </td>
                                            <td class="text-end">@angka($kandang['mati_hari_ini'])</td>
                                            <td class="text-end">
                                                @angka($kandang['mati_kumulatif'])
                                                <span class="d-block small text-body-secondary">@angka($kandang['mortalitas'], 2)%</span>
                                            </td>
                                            <td class="text-end">@angka($kandang['sisa'])</td>
                                            <td class="text-end">
                                                @isset($kandang['abw'])
                                                    @angka($kandang['abw']) g
                                                    <x-selisih :nilai="$kandang['abw_selisih']" class="d-block small" />
                                                @else
                                                    -
                                                @endisset
                                            </td>
                                            <td class="text-end">
                                                @angka($kandang['fcr'], 3)
                                                @isset($kandang['fcr_standar'])
                                                    <span class="d-block small text-body-secondary">standar @angka($kandang['fcr_standar'], 3)</span>
                                                @endisset
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                                @if (count($this->laporan['kandang']) > 1)
                                    <tfoot>
                                        <tr>
                                            <th>Total</th>
                                            <th class="text-end">@angka($this->laporan['total']['mati_hari_ini'])</th>
                                            <th class="text-end">@angka($this->laporan['total']['mati_kumulatif']) (@angka($this->laporan['total']['mortalitas'], 2)%)</th>
                                            <th class="text-end">@angka($this->laporan['total']['sisa'])</th>
                                            <th class="text-end">@angka($this->laporan['total']['abw']) g</th>
                                            <th class="text-end">@angka($this->laporan['total']['fcr'], 3)</th>
                                        </tr>
                                    </tfoot>
                                @endif
                            </table>
                        </div>
                        </div>
                    
</div>
</section>
            </div>

            @if ($this->laporan['catatan'])
                <div class="col-12 mb-4">
                    <x-kartu judul="Catatan recording">
                        <ul class="list-group list-group-flush">
                                @foreach ($this->laporan['catatan'] as $catatan)
                                    <li class="list-group-item"><span class="fw-medium text-body">{{ $catatan['kandang'] }}, {{ $catatan['tanggal']->translatedFormat('j F Y') }}:</span> {{ $catatan['catatan'] }}</li>
                                @endforeach
                            </ul>
                    </x-kartu>
                </div>
            @endif

            <x-laporan.daftar :daftar="$this->daftar" :periode="$this->periode" :tanggal-aktif="$this->laporan['tanggal']" :tanggal-dipilih="$this->tanggalDipilihYangAda" />

            <x-laporan.modal :lembar="$this->dilihat" :periode="$this->periode" />

            <x-konfirmasi id="konfirmasi-hapus-laporan" judul="Hapus laporan harian {{ $this->labelTanggalDihapus }}?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
                Kematian, afkir, ABW, pakan diberikan, dan pakan masuk pada tanggal ini dihapus dan tidak bisa dikembalikan.
            </x-konfirmasi>

            <x-konfirmasi id="konfirmasi-hapus-laporan-terpilih" judul="Hapus laporan terpilih?" aksi="hapusTerpilih" tombol="Ya, hapus semua" warna="danger" memuat="mintaHapusTerpilih">
                {{ count($tanggalHapusTerpilih) }} laporan harian beserta catatan terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </x-konfirmasi>

            <x-memuat target="hapus, hapusTerpilih" teks="Menghapus laporan harian" />

            <div class="col-12 mb-4">
                <p class="small text-body-secondary mb-0">
                    Konversi pakan ke kg memakai berat per zak pada master tiap jenis pakan; pemberian tanpa jenis memakai standar @angka(config('standar.kg_per_zak')) kg/zak. FCR dihitung dari pakan kumulatif per ekor dibagi ABW timbang terakhir.
                </p>
            </div>
        @else
            <x-kosong judul="Belum ada data untuk dilaporkan">
                Laporan harian muncul setelah periode dibuat dan pakan atau recording pertamanya dicatat.
                @if ($this->periode)
                    <x-slot:aksi>
                        <x-tombol data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</x-tombol>
                    </x-slot:aksi>
                @endif
            </x-kosong>
        @endif
    </div>
    @if ($this->periode)
        @livewire(\App\Livewire\FormLaporanHarianModal::class, ['periodeId' => $this->periode->id], key('form-laporan-harian-modal-'.$this->periode->id))
    @endif
</div>
</div>
