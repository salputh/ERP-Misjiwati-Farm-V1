@props(['biaya', 'pinjaman', 'ringkasan'])

{{-- Pengeluaran per kategori dari yang terbesar. Biaya operasional dan pinjaman karyawan dipisah
     supaya terlihat asal angka "Total biaya operasional". Porsi dihitung terhadap seluruh pengeluaran. --}}
<div class="col-xxl-7 mb-25">
    <div class="card card-default card-md h-100">
        <div class="card-header">
            <h6>Pengeluaran per kategori</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">@angka($ringkasan['jumlah_keluar']) transaksi, @angka($ringkasan['jumlah_kategori']) kategori</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan tabel-kas tabel-kas--kategori mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Kategori</span></th>
                            <th class="text-end"><span class="userDatatable-title">Transaksi</span></th>
                            <th class="text-end"><span class="userDatatable-title">Jumlah (Rp)</span></th>
                            <th><span class="userDatatable-title">Porsi dari pengeluaran</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <x-tabel.grup kolom="4" judul="Biaya operasional" />
                        @foreach ($biaya as $baris)
                            <x-kas.baris-kategori :baris="$baris" />
                        @endforeach
                        <tr class="fw-500 color-dark">
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
                            <tr class="fw-500 color-dark">
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
    </div>
</div>
