@props(['slip', 'periode'])

{{-- Slip gaji satu orang: pendapatan, potongan, dan pendapatan bersih yang diterima.
     Kartu sebaris sama tinggi; kotak pendapatan bersih selalu menempel di dasar kartu. --}}
<div
    {{ $attributes->class(['col-xxl-3 col-lg-4 col-md-6 mb-25']) }}
    id="slip-{{ $slip['id'] }}"
    x-data="eksporPayroll"
    data-lembar="{{ json_encode(['periode' => $periode, 'slip' => $slip, 'berkas' => str($slip['nama'].'-'.$slip['kandang'].'-'.$periode)->slug()]) }}"
>
    <div class="card border-0 h-100 slip-gaji">
        <div class="card-header border-0">
            <h6>{{ $slip['nama'] }}</h6>
            <div class="card-extra">
                <span @class(['dm-tag tag-transparented m-0', 'tag-primary' => $slip['jabatan'] === 'ABK', 'tag-info' => $slip['jabatan'] !== 'ABK'])>{{ $slip['jabatan'] }}</span>
            </div>
        </div>
        <div class="card-body pt-0 d-flex flex-column">
            <div class="d-flex flex-wrap justify-content-end gap-2 mb-15">
                <button type="button" class="btn btn-outline-light btn-xs btn-squared tanpa-kapital px-10" x-on:click="simpan" aria-label="Unduh gambar slip">
                    <i class="uil uil-image-download"></i> Unduh
                </button>
                <button type="button" class="btn btn-se btn-xs btn-squared tanpa-kapital px-10" x-on:click="salin" aria-label="Salin gambar slip">
                    <i class="uil uil-copy"></i> <span x-text="labelSalin" aria-live="polite">Salin</span>
                </button>
            </div>
            <p class="fs-13 color-gray mb-15">{{ $slip['kandang'] }}, @angka($slip['hari_kerja']) hari kerja</p>

            <table class="table table-borderless tabel-laporan slip-gaji__tabel mb-20">
                <tbody>
                    <tr class="slip-gaji__bagian">
                        <th colspan="2" scope="colgroup">Pendapatan</th>
                    </tr>
                    @foreach ($slip['pendapatan'] as $baris)
                        <x-payroll.baris :baris="$baris" />
                    @endforeach
                    <tr class="slip-gaji__total">
                        <td>Total pendapatan</td>
                        <td class="text-end">@angka($slip['total_pendapatan'])</td>
                    </tr>

                    <tr class="slip-gaji__bagian">
                        <th colspan="2" scope="colgroup">Potongan</th>
                    </tr>
                    @foreach ($slip['potongan'] as $baris)
                        <x-payroll.baris :baris="$baris" />
                    @endforeach
                    <tr class="slip-gaji__total">
                        <td>Total potongan</td>
                        <td class="text-end">@angka($slip['total_potongan'] ?: null)</td>
                    </tr>
                </tbody>
            </table>

            <div class="slip-gaji__bersih mt-auto">
                <span>Pendapatan bersih diterima</span>
                <strong @class(['color-danger' => $slip['bersih'] < 0])>Rp @kurung($slip['bersih'])</strong>
            </div>
        </div>
    </div>
</div>
