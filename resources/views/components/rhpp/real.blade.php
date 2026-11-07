@props(['lembar', 'masukan', 'hargaPanen', 'nota', 'dapatDiubah' => true, 'terkunci' => false])

{{-- Tab RHPP Real: angka dokumen RHPP dari inti, perbandingan harga per trip, dan alokasi penghasilan per kandang. --}}
@if ($lembar && $lembar['peringatan_sumber'] !== [])
    {{-- Alert template (alert-big) berisi daftar, sehingga ditulis langsung tanpa x-peringatan yang membungkus isinya dengan <p>. --}}
    <div class="col-12 mb-4">
        <div class="alert alert-warning alert-big" role="alert">
            <div class="alert-content">
                <h6 class="alert-heading">Beberapa data sumber RHPP belum lengkap</h6>
                <ul class="mb-0 ps-3">
                    @foreach ($lembar['peringatan_sumber'] as $peringatan)
                        <li>{{ $peringatan }}</li>
                    @endforeach
                </ul>
            </div>
        </div>
    </div>
@endif

@if ($terkunci)
    <div class="col-12 mb-4">
        <x-peringatan warna="info" judul="RHPP real dikunci">
            Dokumen ini sudah dikunci sehingga tidak dapat diubah. Buka kembali dengan password admin bila perlu diperbaiki.
        </x-peringatan>
    </div>
@endif

@if ($dapatDiubah && ! $terkunci)
    <div class="col-12 mb-4">
        <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Input RHPP real dari dokumen inti</h2></div>
                <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">Data RHPP tersimpan sebagai dokumen sementara.</div>
</header>
                <form wire:submit="simpanReal">
                    <div class="row">
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-kantor" label="Kantor inti" wire:model="masukanReal.kantor" :kesalahan="$errors->first('masukanReal.kantor')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-no-siklus" label="No. siklus" wire:model="masukanReal.no_siklus" :kesalahan="$errors->first('masukanReal.no_siklus')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-ppl" label="Nama PPL" wire:model="masukanReal.ppl" :kesalahan="$errors->first('masukanReal.ppl')" />
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3 mb-4">
                                <label for="rhpp-real-tanggal-proses" class="form-label fw-medium mb-2">Tanggal proses</label>
                                <x-pilih-tanggal id="rhpp-real-tanggal-proses" ukuran="medium" :nilai="$masukan['tanggal_proses'] ?? ''" :kesalahan="$errors->has('masukanReal.tanggal_proses')" x-on:tanggal-dipilih="$wire.set('masukanReal.tanggal_proses', $event.detail)" />
                                @error('masukanReal.tanggal_proses')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.doc_diklaim_ekor" teks langsung id="rhpp-real-doc-diklaim" label="DOC diklaim ke inti (ekor)" keterangan="DOC mati di perjalanan dan diklaim kembali ke PT inti; mengurangi DOC dan biaya DOC pada RHPP" :kesalahan="$errors->first('masukanReal.doc_diklaim_ekor')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.doc_ekor" teks id="rhpp-real-doc-ekor" label="DOC (ekor)" keterangan="Populasi DOC dikurangi DOC diklaim" readonly :kesalahan="$errors->first('masukanReal.doc_ekor')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.doc_total" teks id="rhpp-real-doc-total" label="Biaya DOC (Rp)" keterangan="DOC dikurangi DOC diklaim × harga DOC periode" readonly :kesalahan="$errors->first('masukanReal.doc_total')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.pakan_kg" :desimal="2" teks id="rhpp-real-pakan-kg" label="Pakan (kg)" keterangan="Dari catatan pemberian pakan periode" readonly :kesalahan="$errors->first('masukanReal.pakan_kg')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.pakan_total" teks id="rhpp-real-pakan-total" label="Biaya pakan (Rp)" keterangan="Dari jumlah pakan dan harga master" readonly :kesalahan="$errors->first('masukanReal.pakan_total')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.ovk_jumlah" :desimal="2" teks id="rhpp-real-ovk-jumlah" label="OVK (jumlah)" :kesalahan="$errors->first('masukanReal.ovk_jumlah')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-ovk-satuan" label="Satuan OVK" wire:model="masukanReal.ovk_satuan" :kesalahan="$errors->first('masukanReal.ovk_satuan')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.ovk_total" teks id="rhpp-real-ovk-total" label="Biaya OVK (Rp)" keterangan="Sesuai dokumen RHPP inti; pembelian Obat Ayam di kas tidak masuk ke sini" :kesalahan="$errors->first('masukanReal.ovk_total')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-fcr-aktual" tipe="number" min="0" step="0.001" label="FCR aktual" keterangan="Total pakan kg ÷ tonase panen" readonly wire:model="masukanReal.fcr_aktual" :kesalahan="$errors->first('masukanReal.fcr_aktual')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-fcr-standar" tipe="number" min="0" step="0.001" label="FCR standar" keterangan="Standar berbobot menurut umur dan tonase panen" readonly wire:model="masukanReal.fcr_standar" :kesalahan="$errors->first('masukanReal.fcr_standar')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-deplesi-aktual" tipe="number" min="0" max="100" step="0.01" label="Deplesi aktual (%)" keterangan="Dari kematian dan afkir di recording" readonly wire:model="masukanReal.deplesi_persen" :kesalahan="$errors->first('masukanReal.deplesi_persen')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-deplesi-standar" tipe="number" min="0" max="100" step="0.01" label="Deplesi standar (%)" keterangan="Standar periode pada umur panen rata-rata" readonly wire:model="masukanReal.deplesi_standar_persen" :kesalahan="$errors->first('masukanReal.deplesi_standar_persen')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-umur" tipe="number" min="0" step="0.01" label="Umur rata-rata (hari)" keterangan="Berbobot menurut jumlah ekor per tanggal panen" readonly wire:model="masukanReal.umur_rata" :kesalahan="$errors->first('masukanReal.umur_rata')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-ip" tipe="number" min="0" step="1" label="IP" keterangan="Dihitung dari data panen dan recording" readonly wire:model="masukanReal.ip" :kesalahan="$errors->first('masukanReal.ip')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan id="rhpp-real-tarif-efisiensi" tipe="number" min="0" step="1" label="Tarif efisiensi (Rp/kg)" wire:model="masukanReal.tarif_efisiensi_per_kg" :kesalahan="$errors->first('masukanReal.tarif_efisiensi_per_kg')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan.ribuan properti="masukanReal.subsidi_harga_pasar" teks id="rhpp-real-subsidi-harga-pasar" label="Subsidi harga pasar (Rp)" :kesalahan="$errors->first('masukanReal.subsidi_harga_pasar')" />
                        </div>
                    </div>

                    @error('hargaPanenReal')
                        <x-peringatan warna="danger">{{ $message }}</x-peringatan>
                    @enderror

                    @if ($nota->isNotEmpty())
                        <h6 class="mb-3">Harga real tiap nota panen</h6>
                        <div class="tabel-data table-responsive mb-4">
                            <table class="table tabel-laporan mb-0 db-table">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>No. BTPA / SPA</th>
                                        <th class="text-end">Ekor</th>
                                        <th class="text-end">Tonase (kg)</th>
                                        <th class="text-end">Harga real (Rp/kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($nota as $satu)
                                        <tr>
                                            <td>{{ $satu->tanggal_panen->translatedFormat('j M Y') }}</td>
                                            <td>{{ $satu->no_btpa }} / {{ $satu->no_spa ?: '-' }}</td>
                                            <td class="text-end">@angka($satu->ekor)</td>
                                            <td class="text-end">@angka($satu->berat_kg, 2)</td>
                                            <td>
                                                <input
                                                    id="rhpp-real-harga-{{ $satu->id }}"
                                                    type="text"
                                                    inputmode="numeric"
                                                    autocomplete="off"
                                                    @class(['form-control form-control-sm    px-3 text-end', 'is-invalid' => $errors->has('hargaPanenReal.'.$satu->id)])
 x-data="isianRibuan('hargaPanenReal.{{ $satu->id }}', '.', false, { teks: true })"
                                                    x-on:input="format"
                                                    x-on:blur="kirim(true)"
                                                    aria-label="Harga real nota {{ $satu->no_btpa }}"
                                                >
                                                @error('hargaPanenReal.'.$satu->id)
                                                    <div class="invalid-feedback d-block">{{ $message }}</div>
                                                @enderror
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                        <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanReal">Simpan RHPP real</x-tombol>
                    @else
                        <p class="text-body-secondary mb-0">Belum ada nota panen pada periode ini.</p>
                    @endif
                </form>
            
</div>
</section>
    </div>
@endif

@if ($lembar)
<div class="col-12 mb-4">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Dokumen RHPP dari inti</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 d-flex align-items-center gap-2 flex-wrap">
                <span @class(['badge  m-0', 'bg-warning-subtle text-warning' => $lembar['dokumen']->status === 'sementara', 'bg-success-subtle text-success' => $lembar['dokumen']->status !== 'sementara'])>{{ $lembar['dokumen']->status === 'sementara' ? 'Sementara' : 'Dikunci' }}</span>
                @if ($dapatDiubah && ! $terkunci)
                    <x-tombol variasi="outlined" wire:click="bukaModalKunciRhpp" data-bs-toggle="modal" data-bs-target="#modal-kunci-rhpp" wire:loading.attr="disabled" wire:target="bukaModalKunciRhpp">
                        Kunci RHPP
                    </x-tombol>
                @elseif ($terkunci)
                    <x-tombol variasi="outlined" wire:click="bukaModalBukaKunciRhpp" data-bs-toggle="modal" data-bs-target="#modal-kunci-rhpp" wire:loading.attr="disabled" wire:target="bukaModalBukaKunciRhpp">
                        Buka kunci
                    </x-tombol>
                @endif
            </div>
</header>
            <x-info class="mb-0">
                <x-info.butir label="Inti">PT. Indojaya Agrinusa, {{ $lembar['dokumen']->kantor }}</x-info.butir>
                <x-info.butir label="Peternak">Misjiwati</x-info.butir>
                <x-info.butir label="No. siklus">{{ $lembar['dokumen']->no_siklus }}</x-info.butir>
                <x-info.butir label="PPL">{{ $lembar['dokumen']->ppl }}</x-info.butir>
                <x-info.butir label="Tanggal proses">{{ $lembar['dokumen']->tanggal_proses->translatedFormat('j F Y') }}</x-info.butir>
                @if ($lembar['doc_diklaim'] > 0)
                    <x-info.butir label="DOC diklaim ke inti">@angka($lembar['doc_diklaim']) ekor · Rp @angka($lembar['rekap_klaim']['nilai']) (mati di perjalanan)</x-info.butir>
                @endif
            </x-info>
        
</div>
</section>
</div>

<x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['total_panen'] / 1000000, 1).' jt'" label="Total panen ayam" ikon="bi-receipt" warna="primary">
    <small>harga real rata-rata Rp @angka($lembar['kinerja']['harga_rata'], 2) per kg</small>
</x-dashboard.kartu>

<x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['sapronak'] / 1000000, 1).' jt'" label="Total sapronak" ikon="bi-box-seam" warna="secondary">
    <small>DOC, pakan, dan OVK</small>
</x-dashboard.kartu>

<x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['lain'] / 1000000, 1).' jt'" label="Pendapatan lain-lain" ikon="bi-plus-circle" warna="info">
    <small>selisih efisiensi dan subsidi harga pasar</small>
</x-dashboard.kartu>

<x-dashboard.kartu data-lewati-ekspor lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($lembar['rekap']['bersih'] / 1000000, 1).' jt'" label="Pendapatan bersih" ikon="bi-wallet2" warna="warning">
    <small>jumlah dibayar ke peternak</small>
</x-dashboard.kartu>

{{-- Sapronak --}}
<div class="col-lg-6 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Sapronak (biaya)</h2></div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Uraian</th>
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
                            @if ($baris['uraian'] === 'Bibit ayam (DOC)' && $lembar['rekap_klaim'])
                                <tr>
                                    <td>Diklaim ke inti (DOC mati di perjalanan)</td>
                                    <td class="text-end text-nowrap">(@angka($lembar['rekap_klaim']['ekor'])) {{ $baris['satuan'] }}</td>
                                    <td class="text-end">@angka($lembar['rekap_klaim']['harga'], 2)</td>
                                    <td class="text-end">(@angka($lembar['rekap_klaim']['nilai']))</td>
                                </tr>
                            @endif
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3">Total sapronak</th>
                            <th class="text-end">@angka($lembar['sapronak']['total'])</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        
</div>
</section>
</div>

{{-- Hasil panen dan kinerja --}}
<div class="col-lg-6 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Hasil panen dan kinerja peternak</h2></div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Uraian</th>
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
            <p class="small text-body-secondary mt-3 mb-0">Angka <span class="recording-masukan">ungu</span> disalin dari dokumen RHPP inti. Selisih dalam kurung berarti di bawah standar.</p>
        
</div>
</section>
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
    <x-rhpp.baris label="DOC masuk periode" :angka="$lembar['satuan']['doc_dikirim']" satuan="ekor" />
    <x-rhpp.baris label="DOC diklaim ke inti (mati di perjalanan)" :angka="$lembar['satuan']['doc_diklaim']" satuan="ekor" />
    <x-rhpp.baris label="DOC dibesarkan" :angka="$lembar['satuan']['doc']" satuan="ekor" tebal />
    <x-rhpp.baris label="Nilai per ekor DOC" :angka="$lembar['satuan']['nilai_per_doc']" desimal="2" satuan="Rp per ekor" sorot />
</x-rhpp.rincian>

{{-- Perbandingan harga per trip --}}
<div class="col-12 mb-4">
    <section class="card basalt-box db-card" x-data="kartuLipat(false)">
<div class="db-card-body">
        <header class="db-card-head">
<div><h2 class="db-card-title">Perbandingan harga per trip mobil</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 d-flex align-items-center gap-3">
                <span class="small text-body-secondary tanpa-kapital">harga kontrak dan harga real</span>
                <button type="button" class="btn btn-light btn-sm" @click="alihkan" :aria-expanded="terbuka" aria-label="Buka atau tutup perbandingan harga per trip">
                    <i class="bi" :class="terbuka ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
                </button>
            </div>
</header>
        <div x-ref="isi" class="overflow-hidden" x-show="terbuka" x-cloak data-ekspor-buka>
        <div>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0 db-table">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Tanggal</th>
                                <th>No. BTPA / SPA</th>
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
                                    <td>{{ $loop->iteration }}</td>
                                    <td>{{ $trip['tanggal']->translatedFormat('j M') }}</td>
                                    <td>
                                        <span class="d-block fw-medium text-body">{{ $trip['no_btpa'] }}</span>
                                        <span class="d-block small text-body-secondary">SPA {{ $trip['no_spa'] ?? '-' }}</span>
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
                                <th colspan="3">Total</th>
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
            <p class="small text-body-secondary mt-3 mb-0">
                Tonase dan BW dalam kg, harga dalam Rp per kg, nilai dalam Rp. Harga kontrak diambil dari bracket ABW (berat dibagi ekor); harga real adalah harga per nota di dokumen RHPP. Subsidi harga pasar dialokasikan ke tiap trip sebanding tonasenya.
            </p>
        </div>
        </div>
    </div>
</section>
</div>

@if ($lembar['kandang'])
    <x-rhpp.kandang :kandang="$lembar['kandang']" />
@endif
@endif
