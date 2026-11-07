@props(['lembar'])

{{-- Rekap payroll: satu baris per orang, dikelompokkan per kandang dengan subtotalnya. Nama menuju slip orang itu di bawah.
     Di layar HP hanya nama dan bersih diterima yang tampil (rinciannya ada di slip); kolom lain muncul di layar yang lebih lebar. --}}
<div class="col-12 mb-4">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Rekap payroll</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">@angka($lembar['total']['orang']) orang</div>
</header>
            <div class="tabel-data table-responsive">
                    <table class="table tabel-laporan mb-0 db-table">
                        <thead>
                            <tr>
                                <th>Nama</th>
                                <th class="text-start d-none d-md-table-cell">Jabatan</th>
                                <th class="text-end d-none d-md-table-cell">Hari kerja</th>
                                <th class="text-end d-none d-sm-table-cell">Pendapatan (Rp)</th>
                                <th class="text-end d-none d-sm-table-cell">Potongan (Rp)</th>
                                <th class="text-end">Bersih diterima (Rp)</th>
                            </tr>
                        </thead>
                        @foreach ($lembar['kandang'] as $kandang)
                            <tbody wire:key="rekap-{{ $kandang['id'] }}">
                                <x-tabel.grup kolom="6" :judul="$kandang['nama']" :keterangan="\App\Support\Format::angka($kandang['total']['orang']).' orang'" />
                                @foreach ($kandang['slip'] as $slip)
                                    <tr wire:key="rekap-slip-{{ $slip['id'] }}">
                                        <td><a href="#slip-{{ $slip['id'] }}" class="fw-medium">{{ $slip['nama'] }}</a></td>
                                        <td class="text-start d-none d-md-table-cell"><span @class(['badge  m-0', 'bg-primary-subtle text-primary' => $slip['jabatan'] === 'ABK', 'bg-info-subtle text-info' => $slip['jabatan'] !== 'ABK'])>{{ $slip['jabatan'] }}</span></td>
                                        <td class="text-end d-none d-md-table-cell">@angka($slip['hari_kerja'])</td>
                                        <td class="text-end d-none d-sm-table-cell">@angka($slip['total_pendapatan'])</td>
                                        <td class="text-end d-none d-sm-table-cell">@angka($slip['total_potongan'] ?: null)</td>
                                        <td @class(['text-end fw-semibold', 'text-danger' => $slip['bersih'] < 0])>@kurung($slip['bersih'])</td>
                                    </tr>
                                @endforeach
                                <tr class="fw-medium text-body">
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
</section>
</div>
