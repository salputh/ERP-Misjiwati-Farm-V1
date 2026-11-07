@props(['slip', 'periode', 'bisaDiubah' => false])

{{-- Slip gaji satu orang: pendapatan, potongan, dan pendapatan bersih yang diterima.
     Kartu sebaris sama tinggi; kotak pendapatan bersih selalu menempel di dasar kartu. --}}
<div
    {{ $attributes->class(['col-xxl-3 col-lg-4 col-md-6 mb-4']) }}
    id="slip-{{ $slip['id'] }}"
    x-data="eksporPayroll"
    data-lembar="{{ json_encode(['periode' => $periode, 'slip' => $slip, 'berkas' => str($slip['nama'].'-'.$slip['kandang'].'-'.$periode)->slug()]) }}"
>
    <section class="card basalt-box db-card h-100 slip-gaji">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">{{ $slip['nama'] }}</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <span @class(['badge  m-0', 'bg-primary-subtle text-primary' => $slip['jabatan'] === 'ABK', 'bg-info-subtle text-info' => $slip['jabatan'] !== 'ABK'])>{{ $slip['jabatan'] }}</span>
            </div>
</header>
            <div class="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
                @if ($bisaDiubah)
                    <x-aksi.ikon class="me-auto" :aksi="[
                        ['kelas' => 'edit', 'label' => 'Ubah slip gaji '.$slip['nama'], 'click' => 'ubah('.$slip['id'].')', 'modal' => '#modal-slip'],
                        ['kelas' => 'remove', 'label' => 'Hapus slip gaji '.$slip['nama'], 'click' => 'mintaHapus('.$slip['id'].')', 'modal' => '#konfirmasi-hapus-slip'],
                    ]" />
                @endif
                <x-tombol warna="light" variasi="outlined" ukuran="xs" ikon="bi-image" x-on:click="simpan" aria-label="Unduh gambar slip">Unduh</x-tombol>
                <x-tombol warna="light" variasi="outlined" ukuran="xs" ikon="bi-copy" x-on:click="salin" aria-label="Salin gambar slip"><b class="fw-medium" x-text="labelSalin" aria-live="polite">Salin PNG</b></x-tombol>
            </div>
            <p class="small text-body-secondary mb-3">{{ $slip['kandang'] }}, @angka($slip['hari_kerja']) hari kerja</p>

            <table class="table tabel-laporan slip-gaji__tabel mb-3 db-table">
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
                <strong @class(['text-danger' => $slip['bersih'] < 0])>Rp @kurung($slip['bersih'])</strong>
            </div>
        
</div>
</section>
</div>
