@props(['lembar' => null, 'periode'])

{{-- Modal kartu laporan harian satu tanggal, dibuka ikon "Lihat" di daftar laporan; hanya untuk dibaca.
     Isinya dari App\Support\LembarLaporanHarian. Tombol di kaki melukis laporan yang sama dari data-lembar
     menjadi PNG (Alpine eksporLaporan) untuk disimpan atau disalin ke clipboard. --}}
<div class="modal-basic modal fade" id="modal-laporan-harian" tabindex="-1" aria-labelledby="judul-modal-laporan" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <h6 class="modal-title" id="judul-modal-laporan">Laporan harian {{ $lembar['judul'] ?? '' }}</h6>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <i class="uil uil-times"></i>
                </button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="buka" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat laporan harian</span>
                </div>

                <div wire:loading.remove wire:target="buka">
                    @if ($lembar)
                        <dl class="recording-info mb-25">
                            @foreach ($lembar['info'] as $info)
                                <div><dt>{{ $info['label'] }}</dt><dd>{{ $info['nilai'] }}</dd></div>
                            @endforeach
                        </dl>

                        <div class="row g-3 mb-25">
                            @foreach ($lembar['utama'] as $utama)
                                <div class="col-lg-3 col-6">
                                    <div class="laporan-angka h-100">
                                        <span>{{ $utama['label'] }}</span>
                                        <strong>{{ $utama['nilai'] }}</strong>
                                        <small>
                                            @isset($utama['selisih'])
                                                <x-laporan.selisih :selisih="$utama['selisih']" />
                                            @endisset
                                            {{ $utama['catatan'] }}
                                        </small>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4">
                            <div class="col-lg-5">
                                <h6 class="mb-15">Pakan masuk</h6>
                                <div class="table-responsive">
                                    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
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
                                                    <td colspan="3" class="color-gray">Belum ada pakan masuk sampai tanggal ini.</td>
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
                                <h6 class="mb-15">Opname pakan</h6>
                                <div class="table-responsive">
                                    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
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
                                                    <td @class(['text-end', 'color-danger fw-600' => $stok['sisa_kurang']])>{{ $stok['sisa'] }}</td>
                                                </tr>
                                            @endforeach
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th>Total (zak)</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['masuk'] }}</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['terpakai_hari_ini'] }}</th>
                                                <th class="text-end">{{ $lembar['opname']['total']['terpakai'] }}</th>
                                                <th @class(['text-end', 'color-danger' => $lembar['opname']['total']['sisa_kurang']])>{{ $lembar['opname']['total']['sisa'] }}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                @isset($lembar['opname']['catatan'])
                                    <p class="fs-12 color-gray mt-10 mb-0">{{ $lembar['opname']['catatan'] }}</p>
                                @endisset

                                <h6 class="mt-25 mb-15">Mortalitas dan performa</h6>
                                <div class="table-responsive">
                                    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
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
                                                        <span class="d-block fs-12 color-gray">{{ $kandang['populasi'] }}</span>
                                                    </td>
                                                    <td class="text-end">{{ $kandang['mati_hari_ini'] }}</td>
                                                    <td class="text-end">
                                                        {{ $kandang['mati_kumulatif'] }}
                                                        <span class="d-block fs-12 color-gray">{{ $kandang['mortalitas'] }}</span>
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
                                                            <span class="d-block fs-12 color-gray">{{ $kandang['fcr_standar'] }}</span>
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
                            </div>
                        </div>

                        @if ($lembar['catatan'])
                            <h6 class="mt-25 mb-10">Catatan recording</h6>
                            <ul class="mb-0 ps-3">
                                @foreach ($lembar['catatan'] as $catatan)
                                    <li>{{ $catatan }}</li>
                                @endforeach
                            </ul>
                        @endif

                        <p class="fs-12 color-gray mt-25 mb-0">{{ $lembar['keterangan'] }}</p>
                    @endif
                </div>
            </div>

            <div class="modal-footer" x-data="eksporLaporan" data-lembar="{{ json_encode($lembar) }}">
                @if ($lembar)
                    <button type="button" class="btn btn-outline-primary btn-sm" x-on:click="simpan" wire:loading.attr="disabled" wire:target="buka">
                        <i class="uil uil-image-download"></i> Simpan PNG
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" x-on:click="salin" wire:loading.attr="disabled" wire:target="buka">
                        <i class="uil uil-copy"></i> <span x-text="labelSalin" aria-live="polite">Salin PNG</span>
                    </button>
                    <a href="{{ route('laporan.harian.form', ['periode' => $periode->id, 'tanggal' => $lembar['tanggal']]) }}" class="btn btn-outline-light btn-sm">Ubah laporan</a>
                @endif
                <button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Tutup</button>
            </div>
        </div>
    </div>
</div>
