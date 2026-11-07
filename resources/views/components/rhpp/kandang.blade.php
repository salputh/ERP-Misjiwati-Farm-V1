@props(['kandang'])

{{-- Penghasilan per kandang: nilai Rp dialokasikan sebanding tonase panen; kandang terakhir menerima sisanya. --}}
<div class="col-12 mb-4">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Penghasilan per kandang</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <span @class(['badge  m-0', 'bg-success-subtle text-success' => $kandang['cocok'], 'bg-danger-subtle text-danger' => ! $kandang['cocok']])>{{ $kandang['cocok'] ? 'Jumlah sama dengan RHPP' : 'Jumlah berbeda dari RHPP' }}</span>
            </div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Uraian</th>
                            @foreach ($kandang['kolom'] as $kolom)
                                <th class="text-end">{{ $kolom['nama'] }}</th>
                            @endforeach
                            <th class="text-end">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ([
                            ['Jumlah trip mobil', 'trip', 0, '', false],
                            ['Total panen (ekor)', 'ekor', 0, '', false],
                            ['Tonase panen (kg)', 'tonase', 2, '', false],
                            ['BW rata-rata (kg)', 'bw', 3, '', false],
                            ['Share tonase', 'bagian_persen', 1, '%', false],
                            ['Total panen ayam (Rp)', 'total_panen', 0, '', false],
                            ['Total sapronak (Rp)', 'sapronak', 0, '', false],
                            ['Selisih hasil budidaya (Rp)', 'selisih_budidaya', 0, '', false],
                            ['Selisih efisiensi / prestasi (Rp)', 'efisiensi', 0, '', false],
                            ['Subsidi harga pasar (Rp)', 'subsidi', 0, '', false],
                            ['Jumlah pendapatan lain-lain (Rp)', 'lain', 0, '', false],
                            ['Pendapatan bersih per kandang (Rp)', 'bersih', 0, '', true],
                            ['Pendapatan bersih per kg (Rp)', 'bersih_per_kg', 2, '', false],
                            ['Pendapatan bersih per ekor (Rp)', 'bersih_per_ekor', 2, '', false],
                            ['Subsidi harga pasar per kg (Rp)', 'subsidi_per_kg', 2, '', false],
                            ['Pendapatan bersih per trip mobil (Rp)', 'bersih_per_trip', 0, '', false],
                        ] as [$label, $kunci, $desimal, $akhiran, $sorot])
                            <tr @class(['bg-primary-subtle' => $sorot])>
                                <td @class(['fw-semibold' => $sorot])>{{ $label }}</td>
                                @foreach ($kandang['kolom'] as $kolom)
                                    <td @class(['text-end', 'fw-semibold' => $sorot])>@angka($kolom[$kunci], $desimal){{ $akhiran }}</td>
                                @endforeach
                                <td @class(['text-end', 'fw-semibold' => $sorot])>@angka($kandang['total'][$kunci], $desimal){{ $akhiran }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            <p class="small text-body-secondary mt-3 mb-0">
                Tonase, ekor, dan jumlah trip berasal dari rekap panen per kandang. Nilai rupiah dialokasikan sebanding tonase; kandang terakhir menerima sisanya agar jumlahnya tepat sama dengan RHPP.
            </p>
        
</div>
</section>
</div>
