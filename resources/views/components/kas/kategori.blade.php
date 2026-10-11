@props(['biaya', 'pinjaman', 'ringkasan'])

{{-- Pengeluaran per kategori dari yang terbesar. Biaya operasional dan pinjaman karyawan dipisah
     supaya terlihat asal angka "Total biaya operasional". Porsi dihitung terhadap seluruh pengeluaran. --}}
<div class="col-xxl-7 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Pengeluaran per kategori</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">@angka($ringkasan['jumlah_keluar']) transaksi, @angka($ringkasan['jumlah_kategori']) kategori</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-panen tabel-kas tabel-kas--kategori mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">Kategori</th>
                            <th class="text-end">Transaksi</th>
                            <th class="text-end">Jumlah (Rp)</th>
                            <th class="text-start">Porsi dari pengeluaran</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="panen-hari">
                            <th colspan="4" scope="colgroup" class="text-start">Biaya operasional</th>
                        </tr>
                        @foreach ($biaya as $baris)
                            <x-kas.baris-kategori :baris="$baris" />
                        @endforeach
                        <tr class="panen-subtotal">
                            <td class="text-start">Total biaya operasional</td>
                            <td class="text-end">@angka($ringkasan['jumlah_biaya'])</td>
                            <td class="text-end">@angka($ringkasan['biaya'])</td>
                            <td class="text-start">@angka($ringkasan['keluar'] > 0 ? $ringkasan['biaya'] / $ringkasan['keluar'] * 100 : 0, 1)%</td>
                        </tr>
                    </tbody>
                    @if ($pinjaman)
                        <tbody>
                            <tr class="panen-hari">
                                <th colspan="4" scope="colgroup" class="text-start">
                                    Pinjaman karyawan
                                    <span>tidak dihitung sebagai biaya operasional</span>
                                </th>
                            </tr>
                            @foreach ($pinjaman as $baris)
                                <x-kas.baris-kategori :baris="$baris" warna="warning" />
                            @endforeach
                            <tr class="panen-subtotal">
                                <td class="text-start">Total pinjaman karyawan</td>
                                <td class="text-end">@angka($ringkasan['jumlah_pinjaman'])</td>
                                <td class="text-end">@angka($ringkasan['pinjaman'])</td>
                                <td class="text-start">@angka($ringkasan['keluar'] > 0 ? $ringkasan['pinjaman'] / $ringkasan['keluar'] * 100 : 0, 1)%</td>
                            </tr>
                        </tbody>
                    @endif
                    <tfoot>
                        <tr>
                            <th class="text-start">Total pengeluaran</th>
                            <th class="text-end">@angka($ringkasan['jumlah_keluar'])</th>
                            <th class="text-end">@angka($ringkasan['keluar'])</th>
                            <th class="text-start">100%</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>
