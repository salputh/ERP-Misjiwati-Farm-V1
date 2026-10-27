@props(['lembar'])

{{-- Rekap payroll: satu baris per orang, dikelompokkan per kandang dengan subtotalnya. Nama menuju slip orang itu di bawah.
     Di layar HP hanya nama dan bersih diterima yang tampil (rinciannya ada di slip); kolom lain muncul di layar yang lebih lebar. --}}
<div class="col-12 mb-25">
    <div class="card card-default card-md">
        <div class="card-header">
            <h6>Rekap payroll</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">@angka($lembar['total']['orang']) orang</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                    <table class="table tabel-laporan mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">Nama</span></th>
                                <th class="text-start d-none d-md-table-cell"><span class="userDatatable-title">Jabatan</span></th>
                                <th class="text-end d-none d-md-table-cell"><span class="userDatatable-title">Hari kerja</span></th>
                                <th class="text-end d-none d-sm-table-cell"><span class="userDatatable-title">Pendapatan (Rp)</span></th>
                                <th class="text-end d-none d-sm-table-cell"><span class="userDatatable-title">Potongan (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Bersih diterima (Rp)</span></th>
                            </tr>
                        </thead>
                        @foreach ($lembar['kandang'] as $kandang)
                            <tbody wire:key="rekap-{{ $kandang['id'] }}">
                                <x-tabel.grup kolom="6" :judul="$kandang['nama']" :keterangan="\App\Support\Format::angka($kandang['total']['orang']).' orang'" />
                                @foreach ($kandang['slip'] as $slip)
                                    <tr wire:key="rekap-slip-{{ $slip['id'] }}">
                                        <td><a href="#slip-{{ $slip['id'] }}" class="fw-500">{{ $slip['nama'] }}</a></td>
                                        <td class="text-start d-none d-md-table-cell"><span @class(['dm-tag tag-transparented m-0', 'tag-primary' => $slip['jabatan'] === 'ABK', 'tag-info' => $slip['jabatan'] !== 'ABK'])>{{ $slip['jabatan'] }}</span></td>
                                        <td class="text-end d-none d-md-table-cell">@angka($slip['hari_kerja'])</td>
                                        <td class="text-end d-none d-sm-table-cell">@angka($slip['total_pendapatan'])</td>
                                        <td class="text-end d-none d-sm-table-cell">@angka($slip['total_potongan'] ?: null)</td>
                                        <td @class(['text-end fw-600', 'color-danger' => $slip['bersih'] < 0])>@kurung($slip['bersih'])</td>
                                    </tr>
                                @endforeach
                                <tr class="fw-500 color-dark">
                                    <td>Subtotal {{ $kandang['nama'] }}</td>
                                    <td colspan="2" class="d-none d-md-table-cell"></td>
                                    <td class="text-end d-none d-sm-table-cell">@angka($kandang['total']['pendapatan'])</td>
                                    <td class="text-end d-none d-sm-table-cell">@angka($kandang['total']['potongan'])</td>
                                    <td class="text-end">@kurung($kandang['total']['bersih'])</td>
                                </tr>
                            </tbody>
                        @endforeach
                        @if (count($lembar['kandang']) > 1)
                            <tfoot>
                                <tr>
                                    <th>Total semua kandang</th>
                                    <th colspan="2" class="d-none d-md-table-cell"></th>
                                    <th class="text-end d-none d-sm-table-cell">@angka($lembar['total']['pendapatan'])</th>
                                    <th class="text-end d-none d-sm-table-cell">@angka($lembar['total']['potongan'])</th>
                                    <th class="text-end">@kurung($lembar['total']['bersih'])</th>
                                </tr>
                            </tfoot>
                        @endif
                    </table>
            </div>
        </div>
    </div>
</div>
