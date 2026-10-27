@props(['lembar' => null, 'periode'])

{{-- Modal kartu laporan harian satu tanggal, dibuka ikon "Lihat" di daftar laporan; hanya untuk dibaca.
     Isinya dari App\Support\LembarLaporanHarian. Tombol di kaki melukis laporan yang sama dari data-lembar
     menjadi PNG (Alpine eksporLaporan) untuk disimpan atau disalin ke clipboard. --}}
<div class="modal-basic modal fade" id="modal-laporan-harian" tabindex="-1" aria-labelledby="judul-modal-laporan" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" role="document">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <h6 class="modal-title" id="judul-modal-laporan">Laporan harian {{ $lembar['judul'] ?? '' }}</h6>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg">
                </button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="buka" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat laporan harian</span>
                </div>

                <div wire:loading.remove wire:target="buka">
                    @if ($lembar)
                        <x-info class="mb-25">
                            @foreach ($lembar['info'] as $info)
                                <x-info.butir :label="$info['label']">{{ $info['nilai'] }}</x-info.butir>
                            @endforeach
                        </x-info>

                        <div class="row g-3 mb-25">
                            @foreach ($lembar['utama'] as $utama)
                                <div class="col-lg-3 col-6">
                                    <div class="card card-default card-sm bg-transparent card-bordered h-100">
                                        <div class="card-body">
                                            <div class="statistics-item statistics-default">
                                                <span class="statistics-item__title">{{ $utama['label'] }}</span>
                                                <p class="statistics-item__number">{{ $utama['nilai'] }}</p>
                                                <small class="d-block fs-12 color-light mt-1">
                                                    @isset($utama['selisih'])
                                                        <x-laporan.selisih :selisih="$utama['selisih']" />
                                                    @endisset
                                                    {{ $utama['catatan'] }}
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4">
                            <div class="col-lg-5">
                                <h6 class="mb-15">Pakan masuk</h6>
                                <div class="table4 table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0">
                                        <thead>
                                            <tr class="userDatatable-header">
                                                <th><span class="userDatatable-title">Tanggal</span></th>
                                                <th><span class="userDatatable-title">Jenis</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Zak</span></th>
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
                                                    <td colspan="3" class="color-light">Belum ada pakan masuk sampai tanggal ini.</td>
                                                </tr>
                                            @endforelse
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th colspan="2">Total pakan masuk</th>
                                                <th class="text-end"><span class="userDatatable-title">{{ $lembar['pakan_masuk']['total'] }}</span></th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div class="col-lg-7">
                                <h6 class="mb-15">Opname pakan</h6>
                                <div class="table4 table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0">
                                        <thead>
                                            <tr class="userDatatable-header">
                                                <th><span class="userDatatable-title">Jenis</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Masuk</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Terpakai hari ini</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Terpakai s/d hari ini</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Sisa stok</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach ($lembar['opname']['baris'] as $stok)
                                                <tr>
                                                    <td><strong>{{ $stok['jenis'] }}</strong></td>
                                                    <td class="text-end">{{ $stok['masuk'] }}</td>
                                                    <td class="text-end">{{ $stok['terpakai_hari_ini'] }}</td>
                                                    <td class="text-end">{{ $stok['terpakai'] }}</td>
                                                    <td @class(['text-end', 'color-danger fw-600' => $stok['sisa_kurang']])>{{ $stok['sisa'] }}</td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th><span class="userDatatable-title">Total (zak)</span></th>
                                                <th class="text-end"><span class="userDatatable-title">{{ $lembar['opname']['total']['masuk'] }}</span></th>
                                                <th class="text-end"><span class="userDatatable-title">{{ $lembar['opname']['total']['terpakai_hari_ini'] }}</span></th>
                                                <th class="text-end"><span class="userDatatable-title">{{ $lembar['opname']['total']['terpakai'] }}</span></th>
                                                <th @class(['text-end', 'color-danger' => $lembar['opname']['total']['sisa_kurang']])>{{ $lembar['opname']['total']['sisa'] }}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                @isset($lembar['opname']['catatan'])
                                    <p class="fs-13 color-light mt-10 mb-0">{{ $lembar['opname']['catatan'] }}</p>
                                @endisset

                                <h6 class="mt-25 mb-15">Mortalitas dan performa</h6>
                                <div class="table4 table-responsive">
                                    <table class="table tabel-laporan text-nowrap mb-0">
                                        <thead>
                                            <tr class="userDatatable-header">
                                                <th><span class="userDatatable-title">Kandang</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Kematian hari ini</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Kumulatif</span></th>
                                                <th class="text-end"><span class="userDatatable-title">Sisa ayam</span></th>
                                                <th class="text-end"><span class="userDatatable-title">ABW</span></th>
                                                <th class="text-end"><span class="userDatatable-title">FCR</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach ($lembar['kandang']['baris'] as $kandang)
                                                <tr>
                                                    <td>
                                                        <strong>{{ $kandang['nama'] }}</strong>
                                                        <span class="d-block fs-12 color-light">{{ $kandang['populasi'] }}</span>
                                                    </td>
                                                    <td class="text-end">{{ $kandang['mati_hari_ini'] }}</td>
                                                    <td class="text-end">
                                                        {{ $kandang['mati_kumulatif'] }}
                                                        <span class="d-block fs-12 color-light">{{ $kandang['mortalitas'] }}</span>
                                                    </td>
                                                    <td class="text-end">{{ $kandang['sisa'] }}</td>
                                                    <td class="text-end">
                                                        {{ $kandang['abw'] }}
                                                        @isset($kandang['abw_selisih'])
                                                            <x-laporan.selisih :selisih="$kandang['abw_selisih']" class="d-block fs-12" />
                                                        @endisset
                                                    </td>
                                                    <td class="text-end">
                                                        {{ $kandang['fcr'] }}
                                                        @isset($kandang['fcr_standar'])
                                                            <span class="d-block fs-12 color-light">{{ $kandang['fcr_standar'] }}</span>
                                                        @endisset
                                                    </td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                        @isset($lembar['kandang']['total'])
                                            <tfoot>
                                                <tr>
                                                    <th><span class="userDatatable-title">Total</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">{{ $lembar['kandang']['total']['mati_hari_ini'] }}</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">{{ $lembar['kandang']['total']['mati_kumulatif'] }}</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">{{ $lembar['kandang']['total']['sisa'] }}</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">{{ $lembar['kandang']['total']['abw'] }}</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">{{ $lembar['kandang']['total']['fcr'] }}</span></th>
                                                </tr>
                                            </tfoot>
                                        @endisset
                                    </table>
                                </div>
                                <p class="fs-13 color-light mt-10 mb-0">Sisa per kandang belum dikurangi panen karena nota gabungan tidak mencatat kandang asal; total sisa sudah dikurangi seluruh ekor panen sampai tanggal laporan.</p>
                            </div>
                        </div>

                        @if ($lembar['catatan'])
                            <h6 class="mt-25 mb-15">Catatan recording</h6>
                            <div class="list-box">
                                <ul>
                                    @foreach ($lembar['catatan'] as $catatan)
                                        <li class="list-box__item">{{ $catatan }}</li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif

                        <p class="fs-13 color-light mt-25 mb-0">{{ $lembar['keterangan'] }}</p>
                    @endif
                </div>
            </div>

            <div class="modal-footer" x-data="eksporLaporan" data-lembar="{{ json_encode($lembar) }}">
                <x-tombol.batal>Tutup</x-tombol.batal>
                @if ($lembar)
                    <a href="{{ route('laporan.harian.form', ['periode' => $periode->id, 'tanggal' => $lembar['tanggal']]) }}" class="btn btn-outline-primary color-primary btn-sm btn-squared">Ubah laporan</a>
                    <x-tombol warna="light" variasi="outlined" ikon="uil-image-download" x-on:click="simpan" wire:loading.attr="disabled" wire:target="buka">Simpan PNG</x-tombol>
                    <x-tombol ikon="uil-copy" x-on:click="salin" wire:loading.attr="disabled" wire:target="buka"><b class="fw-600" x-text="labelSalin" aria-live="polite">Salin PNG</b></x-tombol>
                @endif
            </div>
        </div>
    </div>
</div>
