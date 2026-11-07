@props(['detail' => null])

{{-- Modal seluruh isi satu nota timbang (satu trip mobil), dibuka ikon "Lihat" di tabel nota; hanya untuk dibaca.
     Isinya dari App\Support\DetailNotaPanen: angka utama, identitas, waktu, timbangan, harga, dan tim tangkap. --}}
<div class="modal fade" id="modal-detail-nota-panen" tabindex="-1" aria-labelledby="judul-detail-nota-panen" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h6 class="modal-title" id="judul-detail-nota-panen">Nota timbang {{ $detail['identitas']['no_btpa'] ?? '' }}</h6>
                    @if ($detail)
                        <span class="d-block small text-body-secondary">
                            @isset($detail['identitas']['hari'])
                                Hari panen {{ $detail['identitas']['hari'] }} ·
                            @endisset
                            {{ $detail['identitas']['tanggal']->translatedFormat('l, j F Y') }} · {{ $detail['identitas']['pembeli'] }}
                        </span>
                    @endif
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="lihat" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat nota timbang</span>
                </div>

                <div wire:loading.remove wire:target="lihat">
                    @if ($detail)
                        {{-- Angka utama --}}
                        <div class="row g-3 mb-4">
                            @foreach ($detail['utama'] as $utama)
                                <div class="col-lg-3 col-6">
                                    <section class="card basalt-box db-card bg-transparent h-100">
<div class="db-card-body">
                                            <div class="border rounded p-3 h-100">
                                                <span class="d-block small text-body-secondary">{{ $utama['label'] }}</span>
                                                <p class="h5 mb-0">{{ $utama['nilai'] }}</p>
                                                <small class="d-block small text-body-secondary mt-1">{{ $utama['catatan'] }}</small>
                                            </div>
                                        
</div>
</section>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4 mb-4">
                            {{-- Identitas dan waktu --}}
                            <div class="col-lg-6">
                                <h6 class="mb-3">Identitas dan waktu</h6>
                                <div class="tabel-data table-responsive">
                                    <table class="table tabel-laporan mb-0 db-table">
                                        <tbody>
                                            <tr><td class="text-body-secondary">No. BTPA</td><td class="text-end fw-medium text-body">{{ $detail['identitas']['no_btpa'] }}</td></tr>
                                            <tr><td class="text-body-secondary">No. SPA</td><td class="text-end fw-medium text-body">{{ $detail['identitas']['no_spa'] ?? '-' }}</td></tr>
                                            <tr><td class="text-body-secondary">Pembeli</td><td class="text-end fw-medium text-body">{{ $detail['identitas']['pembeli'] }}</td></tr>
                                            <tr><td class="text-body-secondary">No. polisi</td><td class="text-end fw-medium text-body">{{ $detail['identitas']['no_polisi'] }}</td></tr>
                                            <tr><td class="text-body-secondary">Tanggal panen</td><td class="text-end fw-medium text-body">{{ $detail['identitas']['tanggal']->translatedFormat('j F Y') }}</td></tr>
                                            <tr><td class="text-body-secondary">Mulai timbang</td><td class="text-end fw-medium text-body">{{ $detail['waktu']['mulai']->translatedFormat('j M Y H:i') }}</td></tr>
                                            <tr><td class="text-body-secondary">Selesai timbang</td><td class="text-end fw-medium text-body">{{ $detail['waktu']['selesai']->translatedFormat('j M Y H:i') }}</td></tr>
                                            <tr><td class="text-body-secondary">Lama timbang</td><td class="text-end fw-medium text-body">{{ $detail['waktu']['durasi'] }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {{-- Timbangan dan harga --}}
                            <div class="col-lg-6">
                                <h6 class="mb-3">Timbangan dan harga</h6>
                                <div class="tabel-data table-responsive">
                                    <table class="table tabel-laporan mb-0 db-table">
                                        <tbody>
                                            <tr><td class="text-body-secondary">Jumlah krat</td><td class="text-end fw-medium text-body">@angka($detail['timbang']['krat'])</td></tr>
                                            <tr><td class="text-body-secondary">Ekor per krat</td><td class="text-end fw-medium text-body">@angka($detail['timbang']['ekor_per_krat'], 1)</td></tr>
                                            <tr><td class="text-body-secondary">Berat timbang</td><td class="text-end fw-medium text-body">@angka($detail['timbang']['berat'], 2) kg</td></tr>
                                            <tr><td class="text-body-secondary">Netto nota</td><td class="text-end fw-medium text-body">@angka($detail['timbang']['netto'], 2) kg</td></tr>
                                            <tr>
                                                <td class="text-body-secondary">Selisih timbang − netto</td>
                                                <td @class(['text-end fw-medium', 'text-danger' => $detail['timbang']['selisih'] != 0, 'text-body' => $detail['timbang']['selisih'] == 0])>@kurung($detail['timbang']['selisih'], 2) kg</td>
                                            </tr>
                                            <tr>
                                                <td class="text-body-secondary">Harga kontrak</td>
                                                <td class="text-end fw-medium text-body">
                                                    @isset($detail['harga']['kontrak'])
                                                        Rp @angka($detail['harga']['kontrak'])/kg
                                                        <span class="d-block small text-body-secondary fw-normal">nilai Rp @angka($detail['harga']['nilai_kontrak'])</span>
                                                    @else
                                                        <span class="small text-body-secondary fw-normal">BW di luar bracket harga kontrak</span>
                                                    @endisset
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="text-body-secondary">Harga real</td>
                                                <td class="text-end fw-medium text-body">
                                                    @isset($detail['harga']['real'])
                                                        Rp @angka($detail['harga']['real'])/kg
                                                        <span class="d-block small text-body-secondary fw-normal">nilai Rp @angka($detail['harga']['nilai_real'])</span>
                                                    @else
                                                        <span class="small text-body-secondary fw-normal">belum diisi di RHPP real</span>
                                                    @endisset
                                                </td>
                                            </tr>
                                            @isset($detail['harga']['selisih_nilai'])
                                                <tr>
                                                    <td class="text-body-secondary">Selisih real − kontrak</td>
                                                    <td @class(['text-end fw-medium', 'text-success' => $detail['harga']['selisih_nilai'] > 0, 'text-danger' => $detail['harga']['selisih_nilai'] < 0])>
                                                        Rp @kurung($detail['harga']['selisih_nilai'])
                                                        <span class="d-block small text-body-secondary fw-normal">@kurung($detail['harga']['selisih_harga']) per kg</span>
                                                    </td>
                                                </tr>
                                            @endisset
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {{-- Tim tangkap --}}
                        <h6 class="mb-3">Tim tangkap</h6>
                        <div class="tabel-data table-responsive">
                            <table class="table tabel-laporan mb-0 db-table">
                                <thead>
                                    <tr>
                                        <th>Pemanen</th>
                                        <th class="text-end">Krat</th>
                                        <th class="text-end">Tonase upah</th>
                                        <th class="text-end">Upah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($detail['tim'] as $orang)
                                        <tr wire:key="detail-tim-{{ $loop->index }}">
                                            <td>
                                                <span class="fw-medium text-body">{{ $orang['nama'] }}</span>
                                                @switch($orang['status'])
                                                    @case('abk')
                                                        <span class="badge bg-info-subtle text-info ms-1 my-0">ABK, tidak dibayar</span>
                                                        @break
                                                    @case('belum_terdaftar')
                                                        <span class="badge bg-warning-subtle text-warning ms-1 my-0">Belum terdaftar</span>
                                                        @break
                                                @endswitch
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @isset($orang['krat_mulai'])
                                                    {{ $orang['krat_mulai'] }}–{{ $orang['krat_selesai'] }}
                                                    <span class="d-block small text-body-secondary">@angka($orang['jumlah_krat']) krat</span>
                                                @else
                                                    <span class="text-body-secondary">semua krat</span>
                                                @endisset
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @angka($orang['berat_kg'], 2) kg
                                                <span class="d-block small text-body-secondary">{{ $orang['cara'] }}</span>
                                            </td>
                                            <td class="text-end text-nowrap">
                                                @isset($orang['upah'])
                                                    <span class="fw-medium text-body">Rp @angka($orang['upah'])</span>
                                                    <span class="d-block small text-body-secondary">Rp @angka($orang['tarif'])/kg</span>
                                                @else
                                                    <span class="text-body-secondary">-</span>
                                                @endisset
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="4" class="text-center text-body-secondary">Nota ini belum mencatat nama tukang tangkap.</td>
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
                            <p class="small text-body-secondary mt-3 mb-0">Nota ini belum memakai krat mulai, jadi setiap nama tukang tangkap dihitung dengan seluruh berat nota.</p>
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
