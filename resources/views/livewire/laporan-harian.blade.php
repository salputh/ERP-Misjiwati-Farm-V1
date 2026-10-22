<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Laporan harian pemeliharaan ayam broiler" :jejak="['Produksi', 'Laporan harian']" />
        <x-periode-tertutup :periode="$this->periode" />

        @isset($pesan)
            <div class="col-lg-12">
                <div class="alert alert-success mb-25" role="status">
                    <div class="alert-content">
                        <p>{{ $pesan }}</p>
                    </div>
                </div>
            </div>
        @endisset

        @if ($this->laporan)
            {{-- Identitas laporan --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-header border-0">
                        <div class="card-extra">
                            <label class="d-flex align-items-center gap-2 mb-0 fs-14 color-gray">
                                Tanggal laporan
                                <x-pilih-tanggal
                                    :nilai="$this->laporan['tanggal']->format('Y-m-d')"
                                    :min="$this->periode->tanggal_chick_in->format('Y-m-d')"
                                    :maks="$this->tanggalTerakhir->format('Y-m-d')"
                                    x-on:tanggal-dipilih="window.location = '{{ route('laporan.harian', ['periode' => $this->periode->id]) }}&tanggal=' + $event.detail"
                                />
                            </label>
                        </div>
                        {{-- Tombol PNG melukis laporan ini dari data-lembar (Alpine eksporLaporan) --}}
                        <div class="card-extra gap-2 flex-row flex-wrap justify-content-center" x-data="eksporLaporan" data-lembar="{{ json_encode($this->lembar) }}">
                            <button type="button" class="btn btn-outline-light btn-sm btn-squared tanpa-kapital" x-on:click="simpan">
                                <i class="uil uil-image-download"></i> Simpan PNG
                            </button>
                            <button type="button" class="btn btn-outline-light btn-sm btn-squared tanpa-kapital" x-on:click="salin">
                                <i class="uil uil-copy"></i> <span x-text="labelSalin" aria-live="polite">Salin PNG</span>
                            </button>
                            @unless ($this->periode->tertutup())
                                <a href="{{ route('laporan.harian.form', ['periode' => $this->periode->id, 'tanggal' => $this->laporan['tanggal']->format('Y-m-d')]) }}" class="btn btn-outline-primary btn-sm btn-squared tanpa-kapital">Ubah laporan ini</a>
                                <button type="button" class="btn btn-primary btn-sm btn-squared tanpa-kapital" data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</button>
                            @endunless
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        <dl class="recording-info mb-0">
                            <div><dt>Peternak</dt><dd>Misjiwati</dd></div>
                            <div><dt>Kandang</dt><dd>{{ collect($this->laporan['kandang'])->pluck('nama')->join(', ') }}</dd></div>
                            <div><dt>Jumlah ayam</dt><dd>@angka($this->laporan['populasi']) ekor</dd></div>
                            <div><dt>Tanggal laporan</dt><dd>{{ $this->laporan['tanggal']->translatedFormat('l, j F Y') }}</dd></div>
                            <div><dt>Usia</dt><dd>{{ $this->laporan['umur'] }} hari</dd></div>
                            <div><dt>Data terakhir</dt><dd>{{ $this->tanggalTerakhir->translatedFormat('j F Y') }}</dd></div>
                        </dl>
                    </div>
                </div>
            </div>

            {{-- Angka utama hari ini --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['sisa'])" label="Sisa ayam di kandang" ikon="uil-layer-group" warna="primary">
                <small>dari @angka($this->laporan['total']['populasi']) ekor chick-in, dikurangi @angka($this->laporan['total']['terpanen']) ekor panen</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['mati_hari_ini'])" label="Kematian hari ini" ikon="uil-heart-break" warna="info">
                <small>kumulatif @angka($this->laporan['total']['mati_kumulatif']) ekor (@angka($this->laporan['total']['mortalitas'], 2)%)</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['abw']).' g'" label="ABW" ikon="uil-weight" warna="secondary">
                @if (count($this->laporan['kandang']) === 1 && isset($this->laporan['kandang'][0]['abw_selisih']))
                    <x-selisih :nilai="$this->laporan['kandang'][0]['abw_selisih']" />
                    <small>dari standar @angka($this->laporan['kandang'][0]['abw_standar']) g</small>
                @else
                    <small>rata-rata tertimbang jumlah ayam</small>
                @endif
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->laporan['total']['fcr'], 3)" label="FCR" ikon="uil-balance-scale" warna="warning">
                @if (count($this->laporan['kandang']) === 1 && isset($this->laporan['kandang'][0]['fcr_standar']))
                    <small>standar @angka($this->laporan['kandang'][0]['fcr_standar'], 3)</small>
                @else
                    <small>pakan per ekor dibagi ABW</small>
                @endif
            </x-dashboard.kartu>

            {{-- Pakan masuk --}}
            <div class="col-xxl-5 mb-25">
                <div class="card border-0 px-25 h-100">
                    <div class="card-header px-0 border-0">
                        <h6>Pakan masuk</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis">
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
                                            <td colspan="3" class="color-gray">Belum ada pakan masuk yang dicatat sampai tanggal ini.</td>
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
            </div>

            {{-- Opname pakan, lalu mortalitas; ditumpuk agar tingginya sama dengan daftar pakan masuk --}}
            <div class="col-xxl-7 d-flex flex-column">
                <div class="card border-0 px-25 mb-25">
                    <div class="card-header px-0 border-0">
                        <h6>Opname pakan</h6>
                        <div class="card-extra fs-14 color-gray tanpa-kapital">
                            @isset($this->laporan['hari_cukup'])
                                Sisa stok cukup sekitar @angka($this->laporan['hari_cukup'], 1) hari dengan pemakaian hari ini
                            @endisset
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table--default table-borderless tabel-laporan">
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
                                            <td @class(['text-end', 'color-danger fw-600' => $stok['sisa'] < 0])>
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
                                                            <div class="progress-bar bg-primary" style="width: {{ $stok['persen_terpakai'] }}%"></div>
                                                        </div>
                                                        <span class="fs-12 color-gray">@angka($stok['persen_terpakai'])%</span>
                                                    </div>
                                                @else
                                                    <span class="fs-12 color-gray">Stok tidak dihitung</span>
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
                                        <th @class(['text-end', 'color-danger' => $this->laporan['total_opname']['sisa'] < 0])>
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

                {{-- Mortalitas dan performa per kandang --}}
                <div class="card border-0 px-25 mb-25 flex-grow-1">
                    <div class="card-header px-0 border-0">
                        <h6>Mortalitas dan performa</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table--default table-borderless tabel-laporan tabel-laporan--rapat">
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
                                                <span class="d-block fs-12 color-gray">@angka($kandang['populasi']) ekor chick-in</span>
                                            </td>
                                            <td class="text-end">@angka($kandang['mati_hari_ini'])</td>
                                            <td class="text-end">
                                                @angka($kandang['mati_kumulatif'])
                                                <span class="d-block fs-12 color-gray">@angka($kandang['mortalitas'], 2)%</span>
                                            </td>
                                            <td class="text-end">@angka($kandang['sisa'])</td>
                                            <td class="text-end">
                                                @isset($kandang['abw'])
                                                    @angka($kandang['abw']) g
                                                    <x-selisih :nilai="$kandang['abw_selisih']" class="d-block fs-12" />
                                                @else
                                                    -
                                                @endisset
                                            </td>
                                            <td class="text-end">
                                                @angka($kandang['fcr'], 3)
                                                @isset($kandang['fcr_standar'])
                                                    <span class="d-block fs-12 color-gray">standar @angka($kandang['fcr_standar'], 3)</span>
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
            </div>

            @if ($this->laporan['catatan'])
                <div class="col-lg-12 mb-25">
                    <div class="card border-0">
                        <div class="card-body p-25">
                            <h6 class="mb-10">Catatan recording</h6>
                            <ul class="mb-0 ps-3">
                                @foreach ($this->laporan['catatan'] as $catatan)
                                    <li>{{ $catatan['kandang'] }}, {{ $catatan['tanggal']->translatedFormat('j F Y') }}: {{ $catatan['catatan'] }}</li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
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

            <div class="col-lg-12">
                <p class="fs-12 color-gray mb-0">
                    Konversi pakan ke kg memakai berat per zak pada master tiap jenis pakan; pemberian tanpa jenis memakai standar @angka(config('standar.kg_per_zak')) kg/zak. FCR dihitung dari pakan kumulatif per ekor dibagi ABW timbang terakhir.
                </p>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada data untuk dilaporkan</h5>
                        <p @class(['color-gray', 'mb-20' => $this->periode, 'mb-0' => ! $this->periode])>Laporan harian muncul setelah periode dibuat dan pakan atau recording pertamanya dicatat.</p>
                        @if ($this->periode)
                            <button type="button" class="btn btn-primary btn-default btn-squared" data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</button>
                        @endif
                    </div>
                </div>
            </div>
        @endif
    </div>
    @if ($this->periode)
        @livewire(\App\Livewire\FormLaporanHarianModal::class, ['periodeId' => $this->periode->id], key('form-laporan-harian-modal-'.$this->periode->id))
    @endif
</div>
