@props(['daftar', 'periodeSlip'])

{{-- Daftar karyawan per kandang . Hari kerja dan bersih diterima diambil dari slip gaji
     periode terakhir yang punya payroll; kolom itu tidak tampil bila belum ada payroll sama sekali.
     Di layar HP keterangan dan hari kerja disembunyikan. Ikon aksi membuka modal ubah (#modal-karyawan) dan
     konfirmasi hapus (#konfirmasi-hapus-karyawan) di halaman Data karyawan. --}}
<div class="col-12 mb-4">
    <x-kartu judul="Daftar karyawan" badan="p-0">
        <x-slot:ekstra class="text-body-secondary tanpa-kapital">
            @isset($periodeSlip)
                slip gaji {{ $periodeSlip->nama }}
            @else
                @angka($daftar['total']) orang
            @endisset
        </x-slot:ekstra>

        <div class="tabel-data">
            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Nama</th>
                            <th>Jabatan</th>
                            <th class="d-none d-md-table-cell">Keterangan</th>
                            <th class="d-none d-lg-table-cell">Gaji bawaan</th>
                            @isset($periodeSlip)
                                <th class="text-end d-none d-md-table-cell">Hari kerja</th>
                                <th class="text-end">Bersih diterima (Rp)</th>
                            @endisset
                            <th class="text-end">Aksi</th>
                        </tr>
                    </thead>
                    @foreach ($daftar['kandang'] as $kandang)
                        <tbody wire:key="kandang-{{ $kandang['nama'] }}">
                            <x-tabel.grup kolom="8" :judul="$kandang['nama']" :keterangan="$kandang['rincian']" />
                            @foreach ($kandang['karyawan'] as $karyawan)
                                <tr wire:key="karyawan-{{ $karyawan['id'] }}">
                                    <td>{{ $loop->iteration }}</td>
                                    <td><div class="fw-medium">{{ $karyawan['nama'] }}</div></td>
                                    <td><span class="badge m-0 {{ $karyawan['jabatan']->kelasTag() }}">{{ $karyawan['jabatan']->label() }}</span></td>
                                    <td class="d-none d-md-table-cell">{{ $karyawan['keterangan'] ?? '-' }}</td>
                                    <td class="d-none d-lg-table-cell">{{ $karyawan['gaji_bawaan'] ?? '-' }}</td>
                                    @isset($periodeSlip)
                                        @isset($karyawan['slip'])
                                            <td class="text-end d-none d-md-table-cell">@angka($karyawan['slip']['hari_kerja'])</td>
                                            <td class="text-end">
                                                <div><a href="{{ route('payroll.abk', ['periode' => $periodeSlip->id]) }}#slip-{{ $karyawan['slip']['id'] }}" class="fw-medium" aria-label="Slip gaji {{ $karyawan['nama'] }}">@kurung($karyawan['slip']['bersih'])</a></div>
                                            </td>
                                        @else
                                            <td class="text-end d-none d-md-table-cell">-</td>
                                            <td class="text-end"><div class="text-body-secondary">belum ada slip</div></td>
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

            <p class="small text-body-secondary mt-3 mb-0">
                Daftar ini sama dengan penerima slip di halaman <a href="{{ route('payroll.abk') }}">Payroll ABK</a>.
                @isset($periodeSlip)
                    Hari kerja dan bersih diterima diambil dari slip gaji {{ $periodeSlip->nama }}; klik angkanya untuk membuka slip.
                @endisset
            </p>
        </div>
    </x-kartu>
</div>
