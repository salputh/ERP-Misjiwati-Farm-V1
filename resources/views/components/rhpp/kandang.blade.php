@props(['kandang'])

{{-- Penghasilan per kandang: nilai Rp dialokasikan sebanding tonase panen; kandang terakhir menerima sisanya. --}}
<div class="col-12 mb-25">
    <div class="card card-default card-md">
        <div class="card-header">
            <h6>Penghasilan per kandang</h6>
            <div class="card-extra">
                <span @class(['dm-tag tag-transparented m-0', 'tag-success' => $kandang['cocok'], 'tag-danger' => ! $kandang['cocok']])>{{ $kandang['cocok'] ? 'Jumlah sama dengan RHPP' : 'Jumlah berbeda dari RHPP' }}</span>
            </div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Uraian</span></th>
                            @foreach ($kandang['kolom'] as $kolom)
                                <th class="text-end"><span class="userDatatable-title">{{ $kolom['nama'] }}</span></th>
                            @endforeach
                            <th class="text-end"><span class="userDatatable-title">Total</span></th>
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
                            <tr @class(['order-bg-opacity-primary' => $sorot])>
                                <td @class(['fw-600' => $sorot])>{{ $label }}</td>
                                @foreach ($kandang['kolom'] as $kolom)
                                    <td @class(['text-end', 'fw-600' => $sorot])>@angka($kolom[$kunci], $desimal){{ $akhiran }}</td>
                                @endforeach
                                <td @class(['text-end', 'fw-600' => $sorot])>@angka($kandang['total'][$kunci], $desimal){{ $akhiran }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            <p class="fs-13 color-light mt-15 mb-0">
                Tonase, ekor, dan jumlah trip berasal dari rekap panen per kandang. Nilai rupiah dialokasikan sebanding tonase; kandang terakhir menerima sisanya agar jumlahnya tepat sama dengan RHPP.
            </p>
        </div>
    </div>
</div>
