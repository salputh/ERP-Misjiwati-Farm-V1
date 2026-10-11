@props(['lembar'])

{{-- Tab RHPP Real: angka dokumen RHPP dari inti, perbandingan harga per trip, dan alokasi penghasilan per kandang. --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0">
        <div class="card-header border-0">
            <h6>Dokumen RHPP dari inti</h6>
            <div class="card-extra">
                <span @class(['dm-tag tag-transparented m-0', 'tag-warning' => $lembar['dokumen']->status === 'sementara', 'tag-success' => $lembar['dokumen']->status !== 'sementara'])>{{ ucfirst($lembar['dokumen']->status) }}</span>
            </div>
        </div>
        <div class="card-body pt-0">
            <dl class="recording-info mb-0">
                <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa, {{ $lembar['dokumen']->kantor }}</dd></div>
                <div><dt>Peternak</dt><dd>Misjiwati</dd></div>
                <div><dt>No. siklus</dt><dd>{{ $lembar['dokumen']->no_siklus }}</dd></div>
                <div><dt>PPL</dt><dd>{{ $lembar['dokumen']->ppl }}</dd></div>
                <div><dt>Tanggal proses</dt><dd>{{ $lembar['dokumen']->tanggal_proses->translatedFormat('j F Y') }}</dd></div>
            </dl>
        </div>
    </div>
</div>

<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['total_panen'] / 1000000, 1).' jt'" label="Total panen ayam" ikon="uil-bill" warna="primary">
    <small>harga real rata-rata Rp @angka($lembar['kinerja']['harga_rata'], 2) per kg</small>
</x-dashboard.kartu>

<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['sapronak'] / 1000000, 1).' jt'" label="Total sapronak" ikon="uil-box" warna="secondary">
    <small>DOC, pakan, dan OVK</small>
</x-dashboard.kartu>

<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['lain'] / 1000000, 1).' jt'" label="Pendapatan lain-lain" ikon="uil-plus-circle" warna="info">
    <small>selisih efisiensi dan subsidi harga pasar</small>
</x-dashboard.kartu>

<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['bersih'] / 1000000, 1).' jt'" label="Pendapatan bersih" ikon="uil-wallet" warna="warning">
    <small>jumlah dibayar ke peternak</small>
</x-dashboard.kartu>

{{-- Sapronak --}}
<div class="col-lg-6 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Sapronak (biaya)</h6>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">Uraian</th>
                            <th class="text-end">Jumlah</th>
                            <th class="text-end">Harga</th>
                            <th class="text-end">Total (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($lembar['sapronak']['baris'] as $baris)
                            <tr>
                                <td>{{ $baris['uraian'] }}</td>
                                <td class="text-end text-nowrap">@angka($baris['jumlah']) {{ $baris['satuan'] }}</td>
                                <td class="text-end">@angka($baris['harga'], 2)</td>
                                <td class="text-end">@angka($baris['total'])</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" class="text-start">Total sapronak</th>
                            <th class="text-end">@angka($lembar['sapronak']['total'])</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>

{{-- Hasil panen dan kinerja --}}
<div class="col-lg-6 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Hasil panen dan kinerja peternak</h6>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">Uraian</th>
                            <th class="text-end">Aktual</th>
                            <th class="text-end">Standar</th>
                            <th class="text-end">Selisih</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Jumlah panen (ekor)</td><td class="text-end">@angka($lembar['kinerja']['ekor'])</td><td></td><td></td></tr>
                        <tr><td>Jumlah panen (kg)</td><td class="text-end">@angka($lembar['kinerja']['berat'], 2)</td><td></td><td></td></tr>
                        <tr><td>Total panen ayam (Rp)</td><td class="text-end">@angka($lembar['kinerja']['total_panen'])</td><td></td><td></td></tr>
                        <tr><td>Harga jual real rata-rata (Rp per kg)</td><td class="text-end">@angka($lembar['kinerja']['harga_rata'], 2)</td><td></td><td></td></tr>
                        <tr><td>BW rata-rata (kg)</td><td class="text-end">@angka($lembar['kinerja']['bw'], 2)</td><td></td><td></td></tr>
                        <tr>
                            <td>FCR hasil panen</td>
                            <td class="text-end recording-masukan">@angka($lembar['kinerja']['fcr']['aktual'], 3)</td>
                            <td class="text-end recording-masukan">@angka($lembar['kinerja']['fcr']['standar'], 3)</td>
                            <td class="text-end">@kurung($lembar['kinerja']['fcr']['selisih'], 3)</td>
                        </tr>
                        <tr>
                            <td>Deplesi (%)</td>
                            <td class="text-end recording-masukan">@angka($lembar['kinerja']['deplesi']['aktual'], 1)%</td>
                            <td class="text-end recording-masukan">@angka($lembar['kinerja']['deplesi']['standar'], 1)%</td>
                            <td class="text-end">@kurung($lembar['kinerja']['deplesi']['selisih'], 1)%</td>
                        </tr>
                        <tr><td>Rata-rata umur pemeliharaan (hari)</td><td class="text-end recording-masukan">@angka($lembar['kinerja']['umur_rata'], 2)</td><td></td><td></td></tr>
                        <tr><td>IP (Index Performance)</td><td class="text-end recording-masukan">@angka($lembar['kinerja']['ip'])</td><td></td><td></td></tr>
                    </tbody>
                </table>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">Angka <span class="recording-masukan">ungu</span> disalin dari dokumen RHPP inti. Selisih dalam kurung berarti di bawah standar.</p>
        </div>
    </div>
</div>

<x-rhpp.rincian judul="Rekapitulasi pendapatan">
    <x-rhpp.baris label="Total panen ayam" :angka="$lembar['rekap']['total_panen']" satuan="Rp" />
    <x-rhpp.baris label="Total sapronak (DOC + pakan + OVK)" :angka="$lembar['rekap']['sapronak']" satuan="Rp" />
    <x-rhpp.baris label="Selisih hasil budidaya" :angka="$lembar['rekap']['selisih_budidaya']" satuan="Rp" tebal />
    <x-rhpp.baris label="Selisih efisiensi (prestasi)" :angka="$lembar['rekap']['efisiensi']" :satuan="'Rp, tarif '.$lembar['rekap']['tarif_efisiensi'].' per kg'" menjorok />
    <x-rhpp.baris label="Subsidi harga pasar" :angka="$lembar['rekap']['subsidi']" satuan="Rp" menjorok masukan />
    <x-rhpp.baris label="Jumlah pendapatan lain-lain" :angka="$lembar['rekap']['lain']" satuan="Rp" tebal />
    <x-rhpp.baris label="Pendapatan bersih (jumlah dibayar)" :angka="$lembar['rekap']['bersih']" satuan="Rp" sorot />
</x-rhpp.rincian>

<x-rhpp.rincian judul="Subsidi dan nilai per satuan">
    <x-rhpp.baris label="Subsidi harga pasar per kg" :angka="$lembar['satuan']['subsidi_per_kg']" desimal="2" satuan="Rp per kg" sorot />
    <x-rhpp.baris label="Subsidi harga pasar per ekor" :angka="$lembar['satuan']['subsidi_per_ekor']" desimal="2" satuan="Rp per ekor" />
    <x-rhpp.baris label="Subsidi + prestasi per kg" :angka="$lembar['satuan']['subsidi_prestasi_per_kg']" desimal="2" satuan="Rp per kg" />
    <x-rhpp.baris label="Selisih hasil budidaya + selisih efisiensi" :angka="$lembar['satuan']['budidaya_efisiensi']" satuan="Rp" tebal />
    <x-rhpp.baris label="Jumlah DOC masuk" :angka="$lembar['satuan']['doc']" satuan="ekor" />
    <x-rhpp.baris label="Nilai per ekor DOC" :angka="$lembar['satuan']['nilai_per_doc']" desimal="2" satuan="Rp per ekor" sorot />
</x-rhpp.rincian>

{{-- Perbandingan harga per trip --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Perbandingan harga per trip mobil</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">harga kontrak dan harga real</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen tabel-panen--lipat mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">No.</th>
                                <th class="text-start">Tanggal</th>
                                <th class="text-start">No. BTPA / SPA</th>
                                <th class="text-end">Ekor</th>
                                <th class="text-end">Tonase</th>
                                <th class="text-end">BW</th>
                                <th class="text-end">Harga real</th>
                                <th class="text-end">Total real</th>
                                <th class="text-end">Harga kontrak</th>
                                <th class="text-end">Total kontrak</th>
                                <th class="text-end">Selisih harga</th>
                                <th class="text-end">Selisih nilai</th>
                                <th class="text-end">Alokasi subsidi</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($lembar['trip'] as $trip)
                                <tr>
                                    <td class="text-start">{{ $loop->iteration }}</td>
                                    <td class="text-start">{{ $trip['tanggal']->translatedFormat('j M') }}</td>
                                    <td class="text-start">
                                        <strong>{{ $trip['no_btpa'] }}</strong>
                                        <span class="d-block fs-12 color-gray">SPA {{ $trip['no_spa'] ?? '-' }}</span>
                                    </td>
                                    <td class="text-end">@angka($trip['ekor'])</td>
                                    <td class="text-end">@angka($trip['berat'], 2)</td>
                                    <td class="text-end">@angka($trip['abw'], 3)</td>
                                    <td class="text-end">@angka($trip['harga_real'])</td>
                                    <td class="text-end">@angka($trip['nilai_real'])</td>
                                    <td class="text-end">@angka($trip['harga_kontrak'])</td>
                                    <td class="text-end">@angka($trip['nilai_kontrak'])</td>
                                    <td class="text-end">@angka($trip['selisih_harga'])</td>
                                    <td class="text-end">@angka($trip['selisih_nilai'])</td>
                                    <td class="text-end">@angka($trip['alokasi_subsidi'])</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="3" class="text-start">Total</th>
                                <th class="text-end">@angka($lembar['total']['ekor'])</th>
                                <th class="text-end">@angka($lembar['total']['berat'], 2)</th>
                                <th class="text-end">@angka($lembar['total']['abw'], 3)</th>
                                <th class="text-end">@angka($lembar['total']['harga_real'], 2)</th>
                                <th class="text-end">@angka($lembar['total']['nilai_real'])</th>
                                <th class="text-end">@angka($lembar['total']['harga_kontrak'], 2)</th>
                                <th class="text-end">@angka($lembar['total']['nilai_kontrak'])</th>
                                <th class="text-end">@angka($lembar['total']['selisih_harga'], 2)</th>
                                <th class="text-end">@angka($lembar['total']['selisih_nilai'])</th>
                                <th class="text-end">@angka($lembar['total']['alokasi_subsidi'])</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Tonase dan BW dalam kg, harga dalam Rp per kg, nilai dalam Rp. Harga kontrak diambil dari bracket ABW (berat dibagi ekor); harga real adalah harga per nota di dokumen RHPP. Subsidi harga pasar dialokasikan ke tiap trip sebanding tonasenya.
            </p>
        </div>
    </div>
</div>

@if ($lembar['kandang'])
    <x-rhpp.kandang :kandang="$lembar['kandang']" />
@endif
