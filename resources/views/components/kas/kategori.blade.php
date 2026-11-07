@props(['biaya', 'pinjaman', 'ringkasan'])

{{-- Pengeluaran per kategori dari yang terbesar. Biaya operasional dan pinjaman karyawan dipisah
     supaya terlihat asal angka "Total biaya operasional". Porsi dihitung terhadap seluruh pengeluaran. --}}
<div class="col-xxl-7 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Pengeluaran per kategori</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">@angka($ringkasan['jumlah_keluar']) transaksi, @angka($ringkasan['jumlah_kategori']) kategori</div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan tabel-kas tabel-kas--kategori mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Kategori</th>
                            <th class="text-end">Transaksi</th>
                            <th class="text-end">Jumlah (Rp)</th>
                            <th>Porsi dari pengeluaran</th>
                        </tr>
                    </thead>
                    <tbody>
                        <x-tabel.grup kolom="4" judul="Biaya operasional" />
                        @foreach ($biaya as $baris)
                            <x-kas.baris-kategori :baris="$baris" />
                        @endforeach
                        <tr class="fw-medium text-body">
                            <td>Total biaya operasional</td>
                            <td class="text-end">@angka($ringkasan['jumlah_biaya'])</td>
                            <td class="text-end">@angka($ringkasan['biaya'])</td>
                            <td>@angka($ringkasan['keluar'] > 0 ? $ringkasan['biaya'] / $ringkasan['keluar'] * 100 : 0, 1)%</td>
                        </tr>
                    </tbody>
                    @if ($pinjaman)
                        <tbody>
                            <x-tabel.grup kolom="4" judul="Pinjaman karyawan" keterangan="tidak dihitung sebagai biaya operasional" />
                            @foreach ($pinjaman as $baris)
                                <x-kas.baris-kategori :baris="$baris" warna="warning" />
                            @endforeach
                            <tr class="fw-medium text-body">
                                <td>Total pinjaman karyawan</td>
                                <td class="text-end">@angka($ringkasan['jumlah_pinjaman'])</td>
                                <td class="text-end">@angka($ringkasan['pinjaman'])</td>
                                <td>@angka($ringkasan['keluar'] > 0 ? $ringkasan['pinjaman'] / $ringkasan['keluar'] * 100 : 0, 1)%</td>
                            </tr>
                        </tbody>
                    @endif
                    <tfoot>
                        <tr>
                            <th>Total pengeluaran</th>
                            <th class="text-end">@angka($ringkasan['jumlah_keluar'])</th>
                            <th class="text-end">@angka($ringkasan['keluar'])</th>
                            <th>100%</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        
</div>
</section>
</div>
