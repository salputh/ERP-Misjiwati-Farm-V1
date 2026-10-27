@props(['daftar', 'periodeSlip'])

{{-- Daftar karyawan per kandang (HexaDash: Basic Table, Basic Usage). Hari kerja dan bersih diterima diambil dari slip gaji
     periode terakhir yang punya payroll; kolom itu tidak tampil bila belum ada payroll sama sekali.
     Di layar HP keterangan dan hari kerja disembunyikan. Ikon aksi membuka modal ubah (#modal-karyawan) dan
     konfirmasi hapus (#konfirmasi-hapus-karyawan) di halaman Data karyawan. --}}
<div class="col-12 mb-25">
    <x-kartu judul="Daftar karyawan" badan="p-0">
        <x-slot:ekstra class="fs-14 color-light tanpa-kapital">
            @isset($periodeSlip)
                slip gaji {{ $periodeSlip->nama }}
            @else
                @angka($daftar['total']) orang
            @endisset
        </x-slot:ekstra>

        <div class="table4 p-25">
            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">No.</span></th>
                            <th><span class="userDatatable-title">Nama</span></th>
                            <th><span class="userDatatable-title">Jabatan</span></th>
                            <th class="d-none d-md-table-cell"><span class="userDatatable-title">Keterangan</span></th>
                            @isset($periodeSlip)
                                <th class="text-end d-none d-md-table-cell"><span class="userDatatable-title">Hari kerja</span></th>
                                <th class="text-end"><span class="userDatatable-title">Bersih diterima (Rp)</span></th>
                            @endisset
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    @foreach ($daftar['kandang'] as $kandang)
                        <tbody wire:key="kandang-{{ $kandang['nama'] }}">
                            <x-tabel.grup kolom="7" :judul="$kandang['nama']" :keterangan="$kandang['rincian']" />
                            @foreach ($kandang['karyawan'] as $karyawan)
                                <tr wire:key="karyawan-{{ $karyawan['id'] }}">
                                    <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                    <td><div class="userDatatable-content fw-500">{{ $karyawan['nama'] }}</div></td>
                                    <td><span class="dm-tag tag-transparented m-0 {{ $karyawan['jabatan']->kelasTag() }}">{{ $karyawan['jabatan']->label() }}</span></td>
                                    <td class="d-none d-md-table-cell"><div class="userDatatable-content">{{ $karyawan['keterangan'] ?? '-' }}</div></td>
                                    @isset($periodeSlip)
                                        @isset($karyawan['slip'])
                                            <td class="text-end d-none d-md-table-cell"><div class="userDatatable-content">@angka($karyawan['slip']['hari_kerja'])</div></td>
                                            <td class="text-end">
                                                <div class="userDatatable-content"><a href="{{ route('payroll.abk', ['periode' => $periodeSlip->id]) }}#slip-{{ $karyawan['slip']['id'] }}" class="fw-500" aria-label="Slip gaji {{ $karyawan['nama'] }}">@kurung($karyawan['slip']['bersih'])</a></div>
                                            </td>
                                        @else
                                            <td class="text-end d-none d-md-table-cell"><div class="userDatatable-content">-</div></td>
                                            <td class="text-end"><div class="userDatatable-content color-light">belum ada slip</div></td>
                                        @endisset
                                    @endisset
                                    <td>
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah karyawan '.$karyawan['nama'], 'click' => 'ubah('.$karyawan['id'].')', 'modal' => '#modal-karyawan'],
                                            ['kelas' => 'remove', 'label' => 'Hapus karyawan '.$karyawan['nama'], 'click' => 'mintaHapus('.$karyawan['id'].')', 'modal' => '#konfirmasi-hapus-karyawan'],
                                        ]" />
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    @endforeach
                </table>
            </div>

            <p class="fs-13 color-light mt-15 mb-0">
                Daftar ini sama dengan penerima slip di halaman <a href="{{ route('payroll.abk') }}">Payroll ABK</a>.
                @isset($periodeSlip)
                    Hari kerja dan bersih diterima diambil dari slip gaji {{ $periodeSlip->nama }}; klik angkanya untuk membuka slip.
                @endisset
            </p>
        </div>
    </x-kartu>
</div>
