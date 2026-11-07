@props(['lembar' => null, 'periode'])

{{-- Modal kartu laporan harian satu tanggal, dibuka ikon "Lihat" di daftar laporan; hanya untuk dibaca.
     Isinya dari App\Support\LembarLaporanHarian. Tombol di kaki melukis laporan yang sama dari data-lembar
     menjadi PNG (Alpine eksporLaporan) untuk disimpan atau disalin ke clipboard. --}}
<div class="modal fade" id="modal-laporan-harian" tabindex="-1" aria-labelledby="judul-modal-laporan" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h6 class="modal-title" id="judul-modal-laporan">Laporan harian {{ $lembar['judul'] ?? '' }}</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="buka" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat laporan harian</span>
                </div>

                <div wire:loading.remove wire:target="buka">
                    @if ($lembar)
                        <x-info class="mb-4">
                            @foreach ($lembar['info'] as $info)
                                <x-info.butir :label="$info['label']">{{ $info['nilai'] }}</x-info.butir>
                            @endforeach
                        </x-info>

                        <div class="row g-3 mb-4">
                            @foreach ($lembar['utama'] as $utama)
                                <div class="col-lg-3 col-6">
                                    <section class="card basalt-box db-card bg-transparent h-100">
<div class="db-card-body">
                                            <div class="border rounded p-3 h-100">
                                                <span class="d-block small text-body-secondary">{{ $utama['label'] }}</span>
                                                <p class="h5 mb-0">{{ $utama['nilai'] }}</p>
                                                <small class="d-block small text-body-secondary mt-1">
                                                    @isset($utama['selisih'])
                                                        <x-laporan.selisih :selisih="$utama['selisih']" />
                                                    @endisset
                                                    {{ $utama['catatan'] }}
                                                </small>
                                            </div>
                                        
</div>
</section>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4">
                            <div class="col-lg-5">
                                <h6 class="mb-3">Pakan masuk</h6>
                                <div class="tabel-data table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0 db-table">
                                        <thead>
                                            <tr>
                                                <th>Tanggal</th>
                                                <th>Jenis</th>
                                                <th class="text-end">Zak</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @forelse ($lembar['pakan_masuk']['baris'] as $masuk)
                                                <tr>
                                                    <td>{{ $masuk['tanggal'] }}</td>
                                                    <td>{{ $masuk['jenis'] }}</td>
                                                    <td class="text-end">{{ $masuk['zak'] }}</td>
                                                </tr>
                                            @empty
                                                <tr>
                                                    <td colspan="3" class="text-body-secondary">Belum ada pakan masuk sampai tanggal ini.</td>
                                                </tr>
                                            @endforelse
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th colspan="2">Total pakan masuk</th>
                                                <th class="text-end">{{ $lembar['pakan_masuk']['total'] }}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div class="col-lg-7">
                                <h6 class="mb-3">Opname pakan</h6>
                                <div class="tabel-data table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0 db-table">
                                        <thead>
                                            <tr>
                                                <th>Jenis</th>
                                                <th class="text-end">Masuk</th>
                                                <th class="text-end">Terpakai hari ini</th>
                                                <th class="text-end">Terpakai s/d hari ini</th>
                                                <th class="text-end">Sisa stok</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach ($lembar['opname']['baris'] as $stok)
                                                <tr>
                                                    <td><strong>{{ $stok['jenis'] }}</strong></td>
                                                    <td class="text-end">{{ $stok['masuk'] }}</td>
                                                    <td class="text-end">{{ $stok['terpakai_hari_ini'] }}</td>
                                                    <td class="text-end">{{ $stok['terpakai'] }}</td>
                                                    <td @class(['text-end', 'text-danger fw-semibold' => $stok['sisa_kurang']])>{{ $stok['sisa'] }}</td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th>Total (zak)</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['masuk'] }}</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['terpakai_hari_ini'] }}</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['terpakai'] }}</th>
                                                <th @class(['text-end', 'text-danger' => $lembar['opname']['total']['sisa_kurang']])>{{ $lembar['opname']['total']['sisa'] }}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                @isset($lembar['opname']['catatan'])
                                    <p class="small text-body-secondary mt-2 mb-0">{{ $lembar['opname']['catatan'] }}</p>
                                @endisset

                                <h6 class="mt-4 mb-3">Mortalitas dan performa</h6>
                                <div class="tabel-data table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0 db-table">
                                        <thead>
                                            <tr>
                                                <th>Kandang</th>
                                                <th class="text-end">Kematian hari ini</th>
                                                <th class="text-end">Kumulatif</th>
                                                <th class="text-end">Sisa ayam</th>
                                                <th class="text-end">ABW</th>
                                                <th class="text-end">FCR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach ($lembar['kandang']['baris'] as $kandang)
                                                <tr>
                                                    <td>
                                                        <strong>{{ $kandang['nama'] }}</strong>
                                                        <span class="d-block small text-body-secondary">{{ $kandang['populasi'] }}</span>
                                                    </td>
                                                    <td class="text-end">{{ $kandang['mati_hari_ini'] }}</td>
                                                    <td class="text-end">
                                                        {{ $kandang['mati_kumulatif'] }}
                                                        <span class="d-block small text-body-secondary">{{ $kandang['mortalitas'] }}</span>
                                                    </td>
                                                    <td class="text-end">{{ $kandang['sisa'] }}</td>
                                                    <td class="text-end">
                                                        {{ $kandang['abw'] }}
                                                        @isset($kandang['abw_selisih'])
                                                            <x-laporan.selisih :selisih="$kandang['abw_selisih']" class="d-block small" />
                                                        @endisset
                                                    </td>
                                                    <td class="text-end">
                                                        {{ $kandang['fcr'] }}
                                                        @isset($kandang['fcr_standar'])
                                                            <span class="d-block small text-body-secondary">{{ $kandang['fcr_standar'] }}</span>
                                                        @endisset
                                                    </td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                        @isset($lembar['kandang']['total'])
                                            <tfoot>
                                                <tr>
                                                    <th>Total</th>
                                                    <th class="text-end">{{ $lembar['kandang']['total']['mati_hari_ini'] }}</th>
                                                    <th class="text-end">{{ $lembar['kandang']['total']['mati_kumulatif'] }}</th>
                                                    <th class="text-end">{{ $lembar['kandang']['total']['sisa'] }}</th>
                                                    <th class="text-end">{{ $lembar['kandang']['total']['abw'] }}</th>
                                                    <th class="text-end">{{ $lembar['kandang']['total']['fcr'] }}</th>
                                                </tr>
                                            </tfoot>
                                        @endisset
                                    </table>
                                </div>
                                <p class="small text-body-secondary mt-2 mb-0">Sisa per kandang belum dikurangi panen karena nota gabungan tidak mencatat kandang asal; total sisa sudah dikurangi seluruh ekor panen sampai tanggal laporan.</p>
                            </div>
                        </div>

                        @if ($lembar['catatan'])
                            <h6 class="mt-4 mb-3">Catatan recording</h6>
                            <ul class="list-group list-group-flush">
                                    @foreach ($lembar['catatan'] as $catatan)
                                        <li class="list-group-item">{{ $catatan }}</li>
                                    @endforeach
                                </ul>
                        @endif

                        <p class="small text-body-secondary mt-4 mb-0">{{ $lembar['keterangan'] }}</p>
                    @endif
                </div>
            </div>

            <div class="modal-footer" x-data="eksporLaporan" data-lembar="{{ json_encode($lembar) }}">
                <x-tombol.batal>Tutup</x-tombol.batal>
                @if ($lembar)
                    <a href="{{ route('laporan.harian.form', ['periode' => $periode->id, 'tanggal' => $lembar['tanggal']]) }}" class="btn btn-outline-primary text-primary btn-sm">Ubah laporan</a>
                    <x-tombol warna="light" variasi="outlined" ikon="bi-image" x-on:click="simpan" wire:loading.attr="disabled" wire:target="buka">Simpan PNG</x-tombol>
                    <x-tombol ikon="bi-copy" x-on:click="salin" wire:loading.attr="disabled" wire:target="buka"><b class="fw-semibold" x-text="labelSalin" aria-live="polite">Salin PNG</b></x-tombol>
                @endif
            </div>
        </div>
    </div>
</div>
