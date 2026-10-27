@props(['detail' => null])

{{-- Modal seluruh isi satu nota timbang (satu trip mobil), dibuka ikon "Lihat" di tabel nota; hanya untuk dibaca.
     Isinya dari App\Support\DetailNotaPanen: angka utama, identitas, waktu, timbangan, harga, dan tim tangkap. --}}
<div class="modal-basic modal fade" id="modal-detail-nota-panen" tabindex="-1" aria-labelledby="judul-detail-nota-panen" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" role="document">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <div>
                    <h6 class="modal-title" id="judul-detail-nota-panen">Nota timbang {{ $detail['identitas']['no_btpa'] ?? '' }}</h6>
                    @if ($detail)
                        <span class="d-block fs-13 color-light">
                            @isset($detail['identitas']['hari'])
                                Hari panen {{ $detail['identitas']['hari'] }} ·
                            @endisset
                            {{ $detail['identitas']['tanggal']->translatedFormat('l, j F Y') }} · {{ $detail['identitas']['pembeli'] }}
                        </span>
                    @endif
                </div>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg">
                </button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="lihat" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat nota timbang</span>
                </div>

                <div wire:loading.remove wire:target="lihat">
                    @if ($detail)
                        {{-- Angka utama --}}
                        <div class="row g-3 mb-25">
                            @foreach ($detail['utama'] as $utama)
                                <div class="col-lg-3 col-6">
                                    <div class="card card-default card-sm bg-transparent card-bordered h-100">
                                        <div class="card-body">
                                            <div class="statistics-item statistics-default">
                                                <span class="statistics-item__title">{{ $utama['label'] }}</span>
                                                <p class="statistics-item__number">{{ $utama['nilai'] }}</p>
                                                <small class="d-block fs-12 color-light mt-1">{{ $utama['catatan'] }}</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4 mb-25">
                            {{-- Identitas dan waktu --}}
                            <div class="col-lg-6">
                                <h6 class="mb-15">Identitas dan waktu</h6>
                                <div class="table4 table-responsive">
                                    <table class="table tabel-laporan mb-0">
                                        <tbody>
                                            <tr><td class="color-light">No. BTPA</td><td class="text-end fw-500 color-dark">{{ $detail['identitas']['no_btpa'] }}</td></tr>
                                            <tr><td class="color-light">No. SPA</td><td class="text-end fw-500 color-dark">{{ $detail['identitas']['no_spa'] ?? '-' }}</td></tr>
                                            <tr><td class="color-light">Pembeli</td><td class="text-end fw-500 color-dark">{{ $detail['identitas']['pembeli'] }}</td></tr>
                                            <tr><td class="color-light">No. polisi</td><td class="text-end fw-500 color-dark">{{ $detail['identitas']['no_polisi'] }}</td></tr>
                                            <tr><td class="color-light">Tanggal panen</td><td class="text-end fw-500 color-dark">{{ $detail['identitas']['tanggal']->translatedFormat('j F Y') }}</td></tr>
                                            <tr><td class="color-light">Mulai timbang</td><td class="text-end fw-500 color-dark">{{ $detail['waktu']['mulai']->translatedFormat('j M Y H:i') }}</td></tr>
                                            <tr><td class="color-light">Selesai timbang</td><td class="text-end fw-500 color-dark">{{ $detail['waktu']['selesai']->translatedFormat('j M Y H:i') }}</td></tr>
                                            <tr><td class="color-light">Lama timbang</td><td class="text-end fw-500 color-dark">{{ $detail['waktu']['durasi'] }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {{-- Timbangan dan harga --}}
                            <div class="col-lg-6">
                                <h6 class="mb-15">Timbangan dan harga</h6>
                                <div class="table4 table-responsive">
                                    <table class="table tabel-laporan mb-0">
                                        <tbody>
                                            <tr><td class="color-light">Jumlah krat</td><td class="text-end fw-500 color-dark">@angka($detail['timbang']['krat'])</td></tr>
                                            <tr><td class="color-light">Ekor per krat</td><td class="text-end fw-500 color-dark">@angka($detail['timbang']['ekor_per_krat'], 1)</td></tr>
                                            <tr><td class="color-light">Berat timbang</td><td class="text-end fw-500 color-dark">@angka($detail['timbang']['berat'], 2) kg</td></tr>
                                            <tr><td class="color-light">Netto nota</td><td class="text-end fw-500 color-dark">@angka($detail['timbang']['netto'], 2) kg</td></tr>
                                            <tr>
                                                <td class="color-light">Selisih timbang − netto</td>
                                                <td @class(['text-end fw-500', 'color-danger' => $detail['timbang']['selisih'] != 0, 'color-dark' => $detail['timbang']['selisih'] == 0])>@kurung($detail['timbang']['selisih'], 2) kg</td>
                                            </tr>
                                            <tr>
                                                <td class="color-light">Harga kontrak</td>
                                                <td class="text-end fw-500 color-dark">
                                                    @isset($detail['harga']['kontrak'])
                                                        Rp @angka($detail['harga']['kontrak'])/kg
                                                        <span class="d-block fs-12 color-light fw-400">nilai Rp @angka($detail['harga']['nilai_kontrak'])</span>
                                                    @else
                                                        <span class="fs-12 color-light fw-400">BW di luar bracket harga kontrak</span>
                                                    @endisset
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="color-light">Harga real</td>
                                                <td class="text-end fw-500 color-dark">
                                                    @isset($detail['harga']['real'])
                                                        Rp @angka($detail['harga']['real'])/kg
                                                        <span class="d-block fs-12 color-light fw-400">nilai Rp @angka($detail['harga']['nilai_real'])</span>
                                                    @else
                                                        <span class="fs-12 color-light fw-400">belum diisi di RHPP real</span>
                                                    @endisset
                                                </td>
                                            </tr>
                                            @isset($detail['harga']['selisih_nilai'])
                                                <tr>
                                                    <td class="color-light">Selisih real − kontrak</td>
                                                    <td @class(['text-end fw-500', 'color-success' => $detail['harga']['selisih_nilai'] > 0, 'color-danger' => $detail['harga']['selisih_nilai'] < 0])>
                                                        Rp @kurung($detail['harga']['selisih_nilai'])
                                                        <span class="d-block fs-12 color-light fw-400">@kurung($detail['harga']['selisih_harga']) per kg</span>
                                                    </td>
                                                </tr>
                                            @endisset
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {{-- Tim tangkap --}}
                        <h6 class="mb-15">Tim tangkap</h6>
                        <div class="table4 table-responsive">
                            <table class="table tabel-laporan mb-0">
                                <thead>
                                    <tr class="userDatatable-header">
                                        <th><span class="userDatatable-title">Pemanen</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Krat</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Tonase upah</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Upah</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($detail['tim'] as $orang)
                                        <tr wire:key="detail-tim-{{ $loop->index }}">
                                            <td>
                                                <span class="fw-500 color-dark">{{ $orang['nama'] }}</span>
                                                @switch($orang['status'])
                                                    @case('abk')
                                                        <span class="dm-tag tag-info tag-transparented ms-1 my-0">ABK, tidak dibayar</span>
                                                        @break
                                                    @case('belum_terdaftar')
                                                        <span class="dm-tag tag-warning tag-transparented ms-1 my-0">Belum terdaftar</span>
                                                        @break
                                                @endswitch
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @isset($orang['krat_mulai'])
                                                    {{ $orang['krat_mulai'] }}–{{ $orang['krat_selesai'] }}
                                                    <span class="d-block fs-12 color-light">@angka($orang['jumlah_krat']) krat</span>
                                                @else
                                                    <span class="color-light">semua krat</span>
                                                @endisset
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @angka($orang['berat_kg'], 2) kg
                                                <span class="d-block fs-12 color-light">{{ $orang['cara'] }}</span>
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @isset($orang['upah'])
                                                    <span class="fw-500 color-dark">Rp @angka($orang['upah'])</span>
                                                    <span class="d-block fs-12 color-light">Rp @angka($orang['tarif'])/kg</span>
                                                @else
                                                    <span class="color-light">-</span>
                                                @endisset
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="4" class="text-center color-light">Nota ini belum mencatat nama tukang tangkap.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                                @if ($detail['tanpa_nama_kg'] > 0 && $detail['tim'] !== [])
                                    <tfoot>
                                        <tr>
                                            <th colspan="2">Belum teralokasi ke pemanen</th>
                                            <th class="text-end text-nowrap">@angka($detail['tanpa_nama_kg'], 2) kg</th>
                                            <th></th>
                                        </tr>
                                    </tfoot>
                                @endif
                            </table>
                        </div>
                        @if ($detail['nota_lama'])
                            <p class="fs-13 color-light mt-15 mb-0">Nota ini belum memakai krat mulai, jadi setiap nama tukang tangkap dihitung dengan seluruh berat nota.</p>
                        @endif
                    @endif
                </div>
            </div>

            <div class="modal-footer">
                <x-tombol.batal>Tutup</x-tombol.batal>
            </div>
        </div>
    </div>
</div>
