@props(['lembar', 'tarifEfisiensiPerKg', 'terkunci' => false])

{{-- Tab Simulasi RHPP: nilai panen menurut harga kontrak per bracket ABW, dikurangi biaya sapronak perkiraan. --}}
<x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['total']['nilai_kontrak'] / 1000000, 1).' jt'" label="Nilai penjualan (harga kontrak)" ikon="uil-bill" warna="primary">
    <small>rata-rata Rp @angka($lembar['total']['harga_kontrak']) per kg</small>
</x-dashboard.kartu>

@if ($lembar['hasil'])
    <x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['hasil']['sapronak'] / 1000000, 1).' jt'" label="Biaya sapronak" ikon="uil-box" warna="secondary">
        <small>HPP Rp @angka($lembar['hasil']['hpp']) per kg</small>
    </x-dashboard.kartu>

    <x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['hasil']['laba'] / 1000000, 1).' jt'" label="Laba sebelum bagi hasil" ikon="uil-wallet" warna="info">
        <small>Rp @angka($lembar['hasil']['laba_per_ekor']) per ekor, Rp @angka($lembar['hasil']['laba_per_kg']) per kg</small>
    </x-dashboard.kartu>

    <x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($lembar['hasil']['margin'], 1).'%'" label="Margin terhadap penjualan" ikon="uil-percentage" warna="warning">
        <small>FCR @angka($lembar['performa']['fcr'], 3) (standar @angka($lembar['performa']['fcr_standar'], 3)), IP @angka($lembar['performa']['ip'])</small>
    </x-dashboard.kartu>
@endif

<x-rhpp.rincian judul="Ringkasan panen dan performa">
    <x-rhpp.baris label="Total ekor terpanen" :angka="$lembar['total']['ekor']" satuan="ekor" />
    <x-rhpp.baris label="Total berat panen" :angka="$lembar['total']['berat']" desimal="2" satuan="kg" />
    <x-rhpp.baris label="ABW rata-rata" :angka="$lembar['total']['abw']" desimal="3" satuan="kg per ekor" />
    <x-rhpp.baris label="Harga jual rata-rata tertimbang" :angka="$lembar['total']['harga_kontrak']" satuan="Rp per kg" />
    <x-rhpp.baris label="Nilai penjualan ayam" :angka="$lembar['total']['nilai_kontrak']" satuan="Rp" tebal />
    <x-rhpp.baris label="FCR" :angka="$lembar['performa']['fcr']" desimal="3" satuan="kg pakan per kg ayam" />
    <x-rhpp.baris label="Umur panen rata-rata" :angka="$lembar['performa']['umur_rata']" desimal="1" satuan="hari" />
    <x-rhpp.baris label="Deplesi" :angka="$lembar['performa']['deplesi_persen']" desimal="2" akhiran="%" satuan="dari DOC masuk" />
    <x-rhpp.baris label="Index Performance (IP)" :angka="$lembar['performa']['ip']" satuan="basis ekor terpanen" />
</x-rhpp.rincian>

@if ($lembar['biaya'] && $lembar['hasil'])
    <x-rhpp.rincian judul="Biaya sapronak">
        <x-rhpp.baris label="Jumlah DOC periode" :angka="$lembar['biaya']['doc']" satuan="ekor" />
        <x-rhpp.baris label="Harga DOC" :angka="$lembar['biaya']['harga_doc']" satuan="Rp per ekor" />
        <x-rhpp.baris label="Biaya DOC" :angka="$lembar['biaya']['biaya_doc']" satuan="Rp" />
        <x-rhpp.baris label="Pakan terpakai" :angka="$lembar['biaya']['pakan_zak']" satuan="zak" />
        <x-rhpp.baris label="Harga pakan" :angka="$lembar['biaya']['harga_pakan']" satuan="Rp per zak, rata-rata tertimbang" />
        <x-rhpp.baris label="Biaya pakan" :angka="$lembar['biaya']['biaya_pakan']" satuan="Rp" />
        <x-rhpp.baris label="Biaya OVK (dokumen RHPP inti)" :angka="$lembar['biaya']['biaya_ovk']" satuan="Rp" />
        <x-rhpp.baris label="Total biaya sapronak" :angka="$lembar['biaya']['total']" satuan="Rp" sorot />
        <x-slot:catatan>Biaya pakan menggunakan harga master terkini dan konsumsi aktual. Rincian sumber ada di tab Sapronak.</x-slot:catatan>
    </x-rhpp.rincian>

    <form class="col-lg-6 mb-25" wire:submit="simpanSimulasi">
        <x-rhpp.rincian judul="Hasil usaha" lebar="col-12">
            <x-rhpp.baris label="Nilai penjualan ayam" :angka="$lembar['hasil']['penjualan']" satuan="Rp" />
            <x-rhpp.baris label="Total biaya sapronak" :angka="$lembar['hasil']['sapronak']" satuan="Rp" />
            <x-rhpp.baris label="Laba kotor (penjualan − sapronak)" :angka="$lembar['hasil']['laba_kotor']" satuan="Rp" tebal />
            <tr>
                <td>Selisih Efisiensi</td>
                <td class="text-end">@angka($lembar['hasil']['selisih_efisiensi'])</td>
                <td class="fs-12 color-light">
                    <div class="input-group flex-nowrap rhpp-tarif-input">
                        <input
                            id="rhpp-tarif-efisiensi"
                            type="number"
                            min="0"
                            max="4294967295"
                            step="1"
                            @class(['form-control form-control-sm ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('tarifEfisiensiPerKg')])
                            wire:model="tarifEfisiensiPerKg"
                            aria-label="Tarif selisih efisiensi per kg"
                            placeholder="Tarif efisiensi per kg"
                            @disabled($terkunci)
                        >
                        <button type="submit" class="btn btn-primary btn-sm" wire:loading.attr="disabled" wire:target="simpanSimulasi" aria-label="Simpan tarif dan hitung ulang" @disabled($terkunci)>
                            <i class="uil uil-save m-0" aria-hidden="true"></i>
                        </button>
                    </div>
                    @error('tarifEfisiensiPerKg')
                        <span class="color-danger d-block mt-1" role="alert">{{ $message }}</span>
                    @enderror
                </td>
            </tr>
            <x-rhpp.baris label="Subsidi Nilai Pasar" :angka="$lembar['hasil']['subsidi_nilai_pasar']" satuan="Rp" />
            <x-rhpp.baris label="Jumlah pendapatan lain-lain" :angka="$lembar['hasil']['pendapatan_lain']" satuan="Rp" tebal />
            <x-rhpp.baris label="Laba sebelum bagi hasil" :angka="$lembar['hasil']['laba']" satuan="Rp" sorot />
            <x-rhpp.baris label="Laba per ekor terpanen" :angka="$lembar['hasil']['laba_per_ekor']" satuan="Rp per ekor" />
            <x-rhpp.baris label="Laba per kg daging" :angka="$lembar['hasil']['laba_per_kg']" satuan="Rp per kg" />
            <x-rhpp.baris label="Harga pokok produksi (HPP)" :angka="$lembar['hasil']['hpp']" satuan="Rp per kg" />
            <x-rhpp.baris label="Margin terhadap penjualan" :angka="$lembar['hasil']['margin']" desimal="1" akhiran="%" />
        </x-rhpp.rincian>
    </form>
@else
    <x-kosong class="col-lg-6" judul="Biaya pakan belum dapat dihitung">Lengkapi jenis pakan dan harga master pada data periode agar estimasi sapronak dan laba dapat dihitung. Lihat tab Sapronak.</x-kosong>
@endif

{{-- Bracket harga kontrak --}}
<div class="col-lg-6 mb-25">
    <div class="card card-default card-md h-100">
        <div class="card-header">
            <h6>Harga kontrak periode ini</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">per bracket ABW</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">ABW (kg per ekor)</span></th>
                            <th class="text-end"><span class="userDatatable-title">Harga (Rp per kg)</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($lembar['bracket'] as $bracket)
                            <tr>
                                <td>
                                    @angka($bracket['dari'], 2)
                                    @isset($bracket['sampai'])
                                        sampai @angka($bracket['sampai'], 2)
                                    @else
                                        ke atas
                                    @endisset
                                </td>
                                <td class="text-end">@angka($bracket['harga'])</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="2" class="color-light">Bracket harga kontrak periode ini belum diisi.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

{{-- Rincian penjualan per nota --}}
<div class="col-12 mb-25">
    <div class="card card-default card-md">
        <div class="card-header">
            <h6>Rincian penjualan per nota timbang</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">@angka($lembar['total']['jumlah_nota']) nota</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                    <table class="table tabel-laporan mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">No.</span></th>
                                <th><span class="userDatatable-title">Hari</span></th>
                                <th><span class="userDatatable-title">No. BTPA / SPA</span></th>
                                <th><span class="userDatatable-title">Pembeli / no. polisi</span></th>
                                <th class="text-end"><span class="userDatatable-title">Ekor</span></th>
                                <th class="text-end"><span class="userDatatable-title">Berat (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">ABW (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Harga kontrak</span></th>
                                <th class="text-end"><span class="userDatatable-title">Nilai penjualan (Rp)</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($lembar['nota'] as $nota)
                                <tr>
                                    <td>{{ $loop->iteration }}</td>
                                    <td>Hari {{ $nota['hari'] }}</td>
                                    <td>
                                        <span class="d-block fw-500 color-dark">{{ $nota['no_btpa'] }}</span>
                                        <span class="d-block fs-12 color-light">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                                    </td>
                                    <td>
                                        {{ $nota['pembeli'] }}
                                        <span class="d-block fs-12 color-light">{{ $nota['no_polisi'] }}</span>
                                    </td>
                                    <td class="text-end">@angka($nota['ekor'])</td>
                                    <td class="text-end">@angka($nota['berat'], 2)</td>
                                    <td class="text-end">@angka($nota['abw'], 3)</td>
                                    <td class="text-end">@angka($nota['harga_kontrak'])</td>
                                    <td class="text-end">@angka($nota['nilai_kontrak'])</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="4">Total</th>
                                <th class="text-end">@angka($lembar['total']['ekor'])</th>
                                <th class="text-end">@angka($lembar['total']['berat'], 2)</th>
                                <th class="text-end">@angka($lembar['total']['abw'], 3)</th>
                                <th class="text-end">@angka($lembar['total']['harga_kontrak'])</th>
                                <th class="text-end">@angka($lembar['total']['nilai_kontrak'])</th>
                            </tr>
                        </tfoot>
                    </table>
            </div>
        </div>
    </div>
</div>

{{-- Proyeksi ke tiap kandang; nilai bersama dibagi dengan dasar yang sesuai data aktualnya. --}}
@if ($lembar['kandang'])
    <div class="col-12 mb-25">
        <div class="card card-default card-md">
            <div class="card-header">
                <div>
                    <h6>Proyeksi simulasi per kandang</h6>
                    <span class="d-block fs-13 color-light fw-400 tanpa-kapital">{{ count($lembar['kandang']['baris']) }} kandang</span>
                </div>
                <div class="card-extra">
                    <span @class(['dm-tag tag-transparented m-0', 'tag-success' => $lembar['kandang']['cocok'], 'tag-danger' => ! $lembar['kandang']['cocok']])>
                        {{ $lembar['kandang']['cocok'] ? 'Nilai rupiah cocok dengan total' : 'Periksa selisih pembulatan' }}
                    </span>
                </div>
            </div>
            <div class="card-body">
                @unless ($lembar['kandang']['panen_sesuai'])
                    <x-peringatan warna="warning">Jumlah ekor atau tonase panen per kandang berbeda dari rekap panen periode. Penjualan tetap dibagi menurut proporsi tonase kandang.</x-peringatan>
                @endunless
                <div class="table4 table-responsive">
                    <table class="table tabel-laporan mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">Kandang</span></th>
                                <th class="text-end"><span class="userDatatable-title">DOC aktual</span></th>
                                <th class="text-end"><span class="userDatatable-title">Pakan (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Ekor panen</span></th>
                                <th class="text-end"><span class="userDatatable-title">Tonase (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Porsi tonase</span></th>
                                <th class="text-end"><span class="userDatatable-title">ABW (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">FCR</span></th>
                                <th class="text-end"><span class="userDatatable-title">Penjualan (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Biaya DOC (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Biaya pakan (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">OVK (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Selisih Efisiensi (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Laba (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">HPP (Rp/kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Margin</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($lembar['kandang']['baris'] as $kandang)
                                <tr>
                                    <td class="fw-500 color-dark">{{ $kandang['nama'] }}</td>
                                    <td class="text-end">@angka($kandang['doc'])</td>
                                    <td class="text-end">@angka($kandang['pakan_kg'], 2)</td>
                                    <td class="text-end">@angka($kandang['ekor'])</td>
                                    <td class="text-end">@angka($kandang['berat'], 2)</td>
                                    <td class="text-end">@angka($kandang['bagian_tonase'], 1)%</td>
                                    <td class="text-end">@angka($kandang['abw'], 3)</td>
                                    <td class="text-end">@angka($kandang['fcr'], 3)</td>
                                    <td class="text-end">@angka($kandang['penjualan'])</td>
                                    <td class="text-end">@angka($kandang['biaya_doc'])</td>
                                    <td class="text-end">@angka($kandang['biaya_pakan'])</td>
                                    <td class="text-end">@angka($kandang['biaya_ovk'])</td>
                                    <td class="text-end">@angka($kandang['selisih_efisiensi'])</td>
                                    <td class="text-end">@angka($kandang['laba'])</td>
                                    <td class="text-end">@angka($kandang['hpp'])</td>
                                    <td class="text-end">@angka($kandang['margin'], 1)%</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>Total</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['doc'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['pakan_kg'], 2)</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['ekor'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['berat'], 2)</th>
                                <th class="text-end">100%</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['abw'], 3)</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['fcr'], 3)</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['penjualan'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['biaya_doc'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['biaya_pakan'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['biaya_ovk'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['selisih_efisiensi'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['laba'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['hpp'])</th>
                                <th class="text-end">@angka($lembar['kandang']['total']['margin'], 1)%</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="fs-13 color-light mt-15 mb-0">
                    Penjualan dan selisih efisiensi dibagi menurut tonase panen; OVK dibagi menurut DOC; biaya DOC mengikuti proporsi DOC aktual dan total dari master; biaya pakan mengikuti konsumsi pakan aktual per kandang. Sisa pembulatan rupiah diberikan ke kandang terakhir.
                </p>
            </div>
        </div>
    </div>
@else
    <x-kosong judul="Proyeksi per kandang belum tersedia">Lengkapi DOC, catatan pemberian pakan, dan rekap ekor serta tonase panen per kandang untuk melihat pembagian simulasi.</x-kosong>
@endif

<div class="col-12 mb-25">
    <p class="fs-13 color-light mb-0">
        Harga tiap nota diambil dari bracket harga kontrak menurut ABW nota (berat dibagi ekor). Tonase dan ekor berasal dari nota timbang di halaman Panen, jadi simulasi ikut berubah bila ada nota baru.
        @if ($lembar['total']['tanpa_harga_kontrak'] > 0)
            Ada @angka($lembar['total']['tanpa_harga_kontrak']) nota dengan ABW di luar bracket; nilainya belum terhitung.
        @endif
    </p>
</div>
