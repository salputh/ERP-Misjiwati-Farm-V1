@props(['performa', 'total', 'tanggalDoc'])

{{-- Perhitungan FCR dan IP. Angka ungu adalah input manual rekap panen; bila kosong dihitung dari recording dan log pakan. --}}
<div class="col-xxl-7 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Perhitungan FCR dan IP</h6>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <tbody>
                        <tr>
                            <td>Konsumsi pakan</td>
                            <td @class(['text-end', 'recording-masukan' => $performa['pakan_manual']])>@angka($performa['pakan_zak']) zak</td>
                            <td class="fs-12 color-gray text-start">{{ $performa['pakan_manual'] ? 'input manual' : 'dari log pemberian pakan' }}</td>
                        </tr>
                        <tr>
                            <td>Berat rata-rata per zak</td>
                            <td class="text-end">@angka($performa['kg_per_zak'], 2) kg</td>
                            <td class="fs-12 color-gray text-start">{{ $performa['pakan_manual'] ? 'standar, input manual' : 'tertimbang dari master jenis pakan' }}</td>
                        </tr>
                        <tr>
                            <td>Total pakan</td>
                            <td class="text-end">@angka($performa['pakan_kg'], 2) kg</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Total berat panen</td>
                            <td class="text-end">@angka($total['berat'], 2) kg</td>
                            <td class="fs-12 color-gray text-start">semua kandang</td>
                        </tr>
                        <tr>
                            <td>Total ekor panen</td>
                            <td class="text-end">@angka($total['ekor']) ekor</td>
                            <td class="fs-12 color-gray text-start">semua kandang</td>
                        </tr>
                        <tr>
                            <td>Rata-rata BW</td>
                            <td class="text-end">@angka($total['bw'], 3) kg</td>
                            <td class="fs-12 color-gray text-start">per ekor</td>
                        </tr>
                        <tr class="baris-sorot">
                            <td><strong>FCR</strong></td>
                            <td class="text-end"><strong>@angka($performa['fcr'], 3)</strong></td>
                            <td class="fs-12 color-gray text-start">kg pakan per kg ayam</td>
                        </tr>
                        <tr>
                            <td>Ayam masuk (DOC)</td>
                            <td class="text-end">@angka($performa['doc']) ekor</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Kematian / deplesi</td>
                            <td @class(['text-end', 'recording-masukan' => $performa['deplesi_manual']])>@angka($performa['deplesi']) ekor</td>
                            <td class="fs-12 color-gray text-start">{{ $performa['deplesi_manual'] ? 'input manual' : 'dari recording harian' }}</td>
                        </tr>
                        <tr>
                            <td>Deplesi</td>
                            <td class="text-end">@angka($performa['deplesi_persen'], 2)%</td>
                            <td class="fs-12 color-gray text-start">dari DOC masuk</td>
                        </tr>
                        <tr>
                            <td>Tanggal DOC masuk</td>
                            <td class="text-end">{{ $tanggalDoc->translatedFormat('j F Y') }}</td>
                            <td class="fs-12 color-gray text-start">umur 0 hari</td>
                        </tr>
                        <tr>
                            <td>Umur panen rata-rata</td>
                            <td class="text-end">@angka($performa['umur_rata'], 1) hari</td>
                            <td class="fs-12 color-gray text-start">tertimbang jumlah ekor</td>
                        </tr>
                        <tr>
                            <td>Persentase hidup, basis ekor terpanen</td>
                            <td class="text-end">@angka($performa['hidup_terpanen'], 2)%</td>
                            <td class="fs-12 color-gray text-start">ekor terpanen ÷ DOC masuk</td>
                        </tr>
                        <tr>
                            <td>Persentase hidup, basis deplesi</td>
                            <td class="text-end">@angka($performa['hidup_deplesi'], 2)%</td>
                            <td class="fs-12 color-gray text-start">100% − deplesi</td>
                        </tr>
                        <tr class="baris-sorot">
                            <td><strong>IP, basis ekor terpanen</strong></td>
                            <td class="text-end"><strong>@angka($performa['ip_terpanen'])</strong></td>
                            <td class="fs-12 color-gray text-start" rowspan="2">(% hidup × BW) ÷ (FCR × umur) × 100</td>
                        </tr>
                        <tr class="baris-sorot">
                            <td><strong>IP, basis populasi hidup</strong></td>
                            <td class="text-end"><strong>@angka($performa['ip_hidup'])</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Angka <span class="recording-masukan">ungu</span> diisi manual di rekap panen. FCR memakai seluruh pakan periode dalam kg dibagi berat ayam yang sudah terpanen. IP disajikan dua versi: basis ekor terpanen (konservatif) dan basis populasi hidup.
            </p>
        </div>
    </div>
</div>
