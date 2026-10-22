@props(['lembar', 'tarifEfisiensiPerKg', 'terkunci' => false])

{{-- Tab Simulasi RHPP: nilai panen menurut harga kontrak per bracket ABW, dikurangi biaya sapronak perkiraan. --}}
<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['total']['nilai_kontrak'] / 1000000, 1).' jt'" label="Nilai penjualan (harga kontrak)" ikon="uil-bill" warna="primary">
    <small>rata-rata Rp @angka($lembar['total']['harga_kontrak']) per kg</small>
</x-dashboard.kartu>

@if ($lembar['hasil'])
    <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['hasil']['sapronak'] / 1000000, 1).' jt'" label="Biaya sapronak" ikon="uil-box" warna="secondary">
        <small>HPP Rp @angka($lembar['hasil']['hpp']) per kg</small>
    </x-dashboard.kartu>

    <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['hasil']['laba'] / 1000000, 1).' jt'" label="Laba sebelum bagi hasil" ikon="uil-wallet" warna="info">
        <small>Rp @angka($lembar['hasil']['laba_per_ekor']) per ekor, Rp @angka($lembar['hasil']['laba_per_kg']) per kg</small>
    </x-dashboard.kartu>

    <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($lembar['hasil']['margin'], 1).'%'" label="Margin terhadap penjualan" ikon="uil-percentage" warna="warning">
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
        <x-rhpp.baris label="Biaya OVK (kas kategori Obat Ayam)" :angka="$lembar['biaya']['biaya_ovk']" satuan="Rp" />
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
                <td class="fs-12 color-gray">
                    <div class="rhpp-tarif-input">
                        <input
                            id="rhpp-tarif-efisiensi"
                            type="number"
                            min="0"
                            max="4294967295"
                            step="false"
                            class="rhpp-tarif-input__field @error('tarifEfisiensiPerKg') is-invalid @enderror"
                            wire:model="tarifEfisiensiPerKg"
                            aria-label="Tarif selisih efisiensi per kg"
                            placeholder="Tarif efisiensi per kg"
                            @disabled($terkunci)
                        >
                        <button
                            type="submit"
                            class="rhpp-tarif-input__button"
                            wire:loading.attr="disabled"
                            wire:target="simpanSimulasi"
                            aria-label="Simpan tarif dan hitung ulang"
                            @disabled($terkunci)
                        >
                            <i class="uil uil-save" wire:loading.remove wire:target="simpanSimulasi" aria-hidden="true"></i>
                            <i class="uil uil-spinner-alt" wire:loading wire:target="simpanSimulasi" aria-hidden="true"></i>
                        </button>
                    </div>
                    @error('tarifEfisiensiPerKg')
                        <span class="color-danger d-block mt-5" role="alert">{{ $message }}</span>
                    @enderror
                    {{-- <span class="d-block">Berlaku jika FCR aktual di bawah standar umur panen.</span> --}}
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
    <div class="col-lg-6 mb-25">
        <div class="card border-0 h-100">
            <div class="card-body p-30">
                <h5 class="mb-10">Biaya pakan belum dapat dihitung</h5>
                <p class="color-gray mb-0">Lengkapi jenis pakan dan harga master pada data periode agar estimasi sapronak dan laba dapat dihitung. Lihat tab Sapronak.</p>
            </div>
        </div>
    </div>
@endif

{{-- Bracket harga kontrak --}}
<div class="col-lg-6 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Harga kontrak periode ini</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">per bracket ABW</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">ABW (kg per ekor)</th>
                            <th class="text-end">Harga (Rp per kg)</th>
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
                                <td colspan="2" class="color-gray">Bracket harga kontrak periode ini belum diisi.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

{{-- Rincian penjualan per nota --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Rincian penjualan per nota timbang</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">@angka($lembar['total']['jumlah_nota']) nota</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">No.</th>
                                <th class="text-start">Hari</th>
                                <th class="text-start">No. BTPA / SPA</th>
                                <th class="text-start">Pembeli / no. polisi</th>
                                <th class="text-end">Ekor</th>
                                <th class="text-end">Berat (kg)</th>
                                <th class="text-end">ABW (kg)</th>
                                <th class="text-end">Harga kontrak</th>
                                <th class="text-end">Nilai penjualan (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($lembar['nota'] as $nota)
                                <tr>
                                    <td class="text-start">{{ $loop->iteration }}</td>
                                    <td class="text-start">Hari {{ $nota['hari'] }}</td>
                                    <td class="text-start">
                                        <strong>{{ $nota['no_btpa'] }}</strong>
                                        <span class="d-block fs-12 color-gray">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                                    </td>
                                    <td class="text-start">
                                        {{ $nota['pembeli'] }}
                                        <span class="d-block fs-12 color-gray">{{ $nota['no_polisi'] }}</span>
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
                                <th colspan="4" class="text-start">Total</th>
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
</div>

{{-- Proyeksi ke tiap kandang; nilai bersama dibagi dengan dasar yang sesuai data aktualnya. --}}
@if ($lembar['kandang'])
    <div class="col-lg-12 mb-25">
        <div class="card border-0 px-25">
            <div class="card-header px-0 border-0">
                <div>
                    <h6>Proyeksi simulasi per kandang</h6>
                    <div class="card-extra fs-14 color-gray tanpa-kapital">{{ count($lembar['kandang']['baris']) }} kandang</div>
                </div>
                <span @class(['dm-tag', 'tag-transparented', 'm-0', 'tag-success' => $lembar['kandang']['cocok'], 'tag-danger' => ! $lembar['kandang']['cocok']])>
                    {{ $lembar['kandang']['cocok'] ? 'Nilai rupiah cocok dengan total' : 'Periksa selisih pembulatan' }}
                </span>
            </div>
            <div class="card-body p-0 pb-25">
                @unless ($lembar['kandang']['panen_sesuai'])
                    <div class="alert alert-warning mx-0 mb-15" role="status">
                        Jumlah ekor atau tonase panen per kandang berbeda dari rekap panen periode. Penjualan tetap dibagi menurut proporsi tonase kandang.
                    </div>
                @endunless
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">Kandang</th>
                                <th class="text-end">DOC aktual</th>
                                <th class="text-end">Pakan (kg)</th>
                                <th class="text-end">Ekor panen</th>
                                <th class="text-end">Tonase (kg)</th>
                                <th class="text-end">Porsi tonase</th>
                                <th class="text-end">ABW (kg)</th>
                                <th class="text-end">FCR</th>
                                <th class="text-end">Penjualan (Rp)</th>
                                <th class="text-end">Biaya DOC (Rp)</th>
                                <th class="text-end">Biaya pakan (Rp)</th>
                                <th class="text-end">OVK (Rp)</th>
                                <th class="text-end">Selisih Efisiensi (Rp)</th>
                                <th class="text-end">Laba (Rp)</th>
                                <th class="text-end">HPP (Rp/kg)</th>
                                <th class="text-end">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($lembar['kandang']['baris'] as $kandang)
                                <tr>
                                    <th class="text-start">{{ $kandang['nama'] }}</th>
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
                                <th class="text-start">Total</th>
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
                <p class="fs-12 color-gray mt-15 mb-0">
                    Penjualan, OVK, dan selisih efisiensi dibagi menurut tonase panen; biaya DOC mengikuti proporsi DOC aktual dan total dari master; biaya pakan mengikuti konsumsi pakan aktual per kandang. Sisa pembulatan rupiah diberikan ke kandang terakhir.
                </p>
            </div>
        </div>
    </div>
@else
    <div class="col-lg-12 mb-25">
        <div class="card border-0">
            <div class="card-body p-25">
                <h6 class="mb-10">Proyeksi per kandang belum tersedia</h6>
                <p class="color-gray mb-0">Lengkapi DOC, catatan pemberian pakan, dan rekap ekor serta tonase panen per kandang untuk melihat pembagian simulasi.</p>
            </div>
        </div>
    </div>
@endif

<div class="col-lg-12">
    <p class="fs-12 color-gray mb-0">
        Harga tiap nota diambil dari bracket harga kontrak menurut ABW nota (berat dibagi ekor). Tonase dan ekor berasal dari nota timbang di halaman Panen, jadi simulasi ikut berubah bila ada nota baru.
        @if ($lembar['total']['tanpa_harga_kontrak'] > 0)
            Ada @angka($lembar['total']['tanpa_harga_kontrak']) nota dengan ABW di luar bracket; nilainya belum terhitung.
        @endif
    </p>
</div>
