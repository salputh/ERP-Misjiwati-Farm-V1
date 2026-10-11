@props(['abk'])

{{-- Rekap pendapatan ABK: asal totalnya di kiri, pembagian per orang di kanan.
     Premi tetap diambil dulu dari total untuk penerimanya; sisanya dibagi rata. --}}
<div class="col-lg-12 order-5 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Rekap pendapatan ABK</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">@angka(count($abk['penerima'])) ABK</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="row">
                <div class="col-xxl-5 rincian-kas mb-xxl-0 mb-25">
                    <div class="table-responsive">
                        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                            <tbody>
                                @foreach ($abk['rekap'] as $baris)
                                    <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :sorot="$baris['sorot']" />
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="col-xxl-7">
                    <div class="table-responsive">
                        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
                            <thead>
                                <tr>
                                    <th class="text-start">Pembagian ABK</th>
                                    <th class="text-end">Bagian rata (Rp)</th>
                                    <th class="text-end">Premi tetap (Rp)</th>
                                    <th class="text-end">Jumlah (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($abk['penerima'] as $satu)
                                    <tr>
                                        <td class="text-start">
                                            {{ $satu['nama'] }}
                                            @isset($satu['keterangan'])
                                                <span class="fs-12 color-gray">{{ $satu['keterangan'] }}</span>
                                            @endisset
                                        </td>
                                        <td class="text-end">@angka($satu['rata'])</td>
                                        <td class="text-end">@kurung($satu['premi_tetap'] ?: null)</td>
                                        <td class="text-end fw-600">@angka($satu['jumlah'])</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="color-gray">Daftar ABK kandang ini belum diisi.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th class="text-start">Total</th>
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
                <p class="fs-12 color-gray mt-15 mb-0">Premi tetap diambil lebih dulu dari total pendapatan ABK untuk penerimanya; sisanya dibagi rata ke semua ABK.</p>
            @endif
        </div>
    </div>
</div>
