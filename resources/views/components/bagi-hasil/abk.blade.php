@props(['abk'])

{{-- Rekap pendapatan ABK: asal totalnya di kiri, pembagian per orang di kanan.
     Premi tetap diambil dulu dari total untuk penerimanya; sisanya dibagi rata. --}}
<div class="col-lg-12 order-5 mb-4">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Rekap pendapatan ABK</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">@angka(count($abk['penerima'])) ABK</div>
</header>
            <div class="row">
                <div class="col-xxl-5 mb-xxl-0 mb-4">
                    <div class="tabel-data table-responsive">
                        <table class="table tabel-laporan mb-0 db-table">
                            <tbody>
                                @foreach ($abk['rekap'] as $baris)
                                    <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :sorot="$baris['sorot']" />
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="col-xxl-7">
                    <div class="tabel-data table-responsive">
                        <table class="table tabel-laporan text-nowrap mb-0 db-table">
                            <thead>
                                <tr>
                                    <th>Pembagian ABK</th>
                                    <th class="text-end">Bagian rata (Rp)</th>
                                    <th class="text-end">Premi tetap (Rp)</th>
                                    <th class="text-end">Jumlah (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($abk['penerima'] as $satu)
                                    <tr>
                                        <td>
                                            {{ $satu['nama'] }}
                                            @isset($satu['keterangan'])
                                                <span class="small text-body-secondary">{{ $satu['keterangan'] }}</span>
                                            @endisset
                                        </td>
                                        <td class="text-end">@angka($satu['rata'])</td>
                                        <td class="text-end">@kurung($satu['premi_tetap'] ?: null)</td>
                                        <td class="text-end fw-semibold">@angka($satu['jumlah'])</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="text-body-secondary">Daftar ABK kandang ini belum diisi.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th>Total</th>
                                    <th class="text-end">@angka($abk['rata'])</th>
                                    <th class="text-end">@kurung($abk['premi_tetap'] ?: null)</th>
                                    <th class="text-end">@angka($abk['total'])</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            @if ($abk['premi_tetap'] > 0)
                <p class="small text-body-secondary mt-3 mb-0">Premi tetap diambil lebih dulu dari total pendapatan ABK untuk penerimanya; sisanya dibagi rata ke semua ABK.</p>
            @endif
        
</div>
</section>
</div>
