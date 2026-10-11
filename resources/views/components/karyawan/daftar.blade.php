@props(['daftar', 'periodeSlip'])

{{-- Daftar karyawan per kandang. Hari kerja dan bersih diterima diambil dari slip gaji periode terakhir yang punya payroll;
     kolom itu tidak tampil bila belum ada payroll sama sekali. Di layar HP keterangan dan hari kerja disembunyikan. --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Daftar karyawan</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">
                @isset($periodeSlip)
                    slip gaji {{ $periodeSlip->nama }}
                @else
                    @angka($daftar['total']) orang
                @endisset
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">No.</th>
                                <th class="text-start">Nama</th>
                                <th class="text-start">Jabatan</th>
                                <th class="text-start d-none d-md-table-cell">Keterangan</th>
                                @isset($periodeSlip)
                                    <th class="text-end d-none d-md-table-cell">Hari kerja</th>
                                    <th class="text-end">Bersih diterima (Rp)</th>
                                @endisset
                            </tr>
                        </thead>
                        @foreach ($daftar['kandang'] as $kandang)
                            <tbody>
                                <tr class="panen-hari">
                                    <th colspan="6" scope="colgroup" class="text-start">
                                        {{ $kandang['nama'] }}
                                        <span>{{ $kandang['rincian'] }}</span>
                                    </th>
                                </tr>
                                @foreach ($kandang['karyawan'] as $karyawan)
                                    <tr>
                                        <td class="text-start">{{ $loop->iteration }}</td>
                                        <td class="text-start fw-500 color-dark">{{ $karyawan['nama'] }}</td>
                                        <td class="text-start"><span class="dm-tag tag-transparented m-0 {{ $karyawan['jabatan']->kelasTag() }}">{{ $karyawan['jabatan']->label() }}</span></td>
                                        <td class="text-start d-none d-md-table-cell">{{ $karyawan['keterangan'] ?? '-' }}</td>
                                        @isset($periodeSlip)
                                            @isset($karyawan['slip'])
                                                <td class="text-end d-none d-md-table-cell">@angka($karyawan['slip']['hari_kerja'])</td>
                                                <td class="text-end">
                                                    <a href="{{ route('payroll.abk', ['periode' => $periodeSlip->id]) }}#slip-{{ $karyawan['slip']['id'] }}" class="fw-600" aria-label="Slip gaji {{ $karyawan['nama'] }}">@kurung($karyawan['slip']['bersih'])</a>
                                                </td>
                                            @else
                                                <td class="text-end d-none d-md-table-cell">-</td>
                                                <td class="text-end color-gray">belum ada slip</td>
                                            @endisset
                                        @endisset
                                    </tr>
                                @endforeach
                            </tbody>
                        @endforeach
                    </table>
                </div>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Daftar ini sama dengan penerima slip di halaman <a href="{{ route('payroll.abk') }}">Payroll ABK</a>.
                @isset($periodeSlip)
                    Hari kerja dan bersih diterima diambil dari slip gaji {{ $periodeSlip->nama }}; klik angkanya untuk membuka slip.
                @endisset
            </p>
        </div>
    </div>
</div>
