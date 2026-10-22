@props(['simulasi', 'real'])

<div class="col-lg-12 mb-25">
    <x-kartu tanpaHeader="true" class="border-0">
        <h5 class="mb-10">Perhitungan otomatis biaya sapronak</h5>
        <p class="color-gray mb-0">Estimasi menggunakan populasi DOC pada periode, pemakaian pakan per jenis, harga master pakan terkini, dan transaksi kas kategori Obat Ayam. RHPP Real tetap mengambil angka resmi dari dokumen inti.</p>
    </x-kartu>
</div>

@if ($simulasi['kekurangan'])
    <div class="col-lg-12 mb-25">
        <x-peringatan warna="warning">
            Biaya sapronak belum lengkap: {{ implode(' ', $simulasi['kekurangan']) }}
        </x-peringatan>
    </div>
@endif

<div class="col-lg-12 mb-25">
    <x-peringatan warna="warning">
        OVK simulasi mengambil transaksi Obat Ayam dari Kas Operasional. Transaksi yang sama juga tercatat sebagai biaya operasional dan dapat mengurangi hasil di Bagi Hasil; pastikan pembelian tidak dihitung dua kali.
    </x-peringatan>
</div>

<div class="col-lg-6 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Estimasi otomatis dari data periode</h6>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">Komponen / kandang</th>
                            <th class="text-end">Jumlah</th>
                            <th class="text-end">Harga</th>
                            <th class="text-end">Total (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($simulasi['doc']['baris'] as $baris)
                            <tr>
                                <td>DOC · {{ $baris['kandang'] }}</td>
                                <td class="text-end text-nowrap">@angka($baris['jumlah']) ekor</td>
                                <td class="text-end">@angka($baris['harga']) / ekor</td>
                                <td class="text-end">@angka($baris['total'])</td>
                            </tr>
                        @endforeach
                        @forelse ($simulasi['pakan']['baris'] as $baris)
                            <tr>
                                <td>
                                    Pakan {{ $baris['jenis'] }}
                                    <span class="d-block fs-12 color-gray">{{ $baris['kandang'] }}</span>
                                    @if ($baris['masalah'])
                                        <span class="d-block fs-12 color-danger">{{ $baris['masalah'] }}</span>
                                    @endif
                                </td>
                                <td class="text-end text-nowrap">
                                    @angka($baris['zak'], 2) zak
                                    @if ($baris['kg'] !== null)
                                        <span class="d-block fs-12 color-gray">@angka($baris['kg'], 2) kg</span>
                                    @endif
                                </td>
                                <td class="text-end">
                                    @if ($baris['harga_per_kg'] !== null)
                                        @angka($baris['harga_per_kg']) / kg
                                    @else
                                        —
                                    @endif
                                </td>
                                <td class="text-end">
                                    {{ $baris['total'] === null ? 'Belum dihitung' : \App\Support\Format::angka($baris['total']) }}
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="4" class="color-gray">Belum ada catatan pemberian pakan.</td></tr>
                        @endforelse
                        @foreach ($simulasi['ovk']['baris'] as $baris)
                            <tr>
                                <td>OVK · {{ $baris['kandang'] }} <span class="d-block fs-12 color-gray">Kas: Obat Ayam</span></td>
                                <td class="text-end">—</td>
                                <td class="text-end">—</td>
                                <td class="text-end">@angka($baris['total'])</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" class="text-start">Total sapronak simulasi</th>
                            <th class="text-end">{{ $simulasi['total'] === null ? 'Belum lengkap' : \App\Support\Format::angka($simulasi['total']) }}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">Harga pakan memakai master terkini, bukan harga historis pembelian. Perbarui harga pada Master Data untuk menyesuaikan estimasi.</p>
        </div>
    </div>
</div>

<div class="col-lg-6 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Realisasi dari dokumen RHPP inti</h6>
        </div>
        @if ($real)
            <div class="card-body p-0 pb-25">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">Uraian</th>
                                <th class="text-end">Jumlah</th>
                                <th class="text-end">Harga</th>
                                <th class="text-end">Total (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($real['sapronak']['baris'] as $baris)
                                <tr>
                                    <td>{{ $baris['uraian'] }}</td>
                                    <td class="text-end text-nowrap">@angka($baris['jumlah'], 2) {{ $baris['satuan'] }}</td>
                                    <td class="text-end">{{ $baris['harga'] === null ? '—' : \App\Support\Format::angka($baris['harga'], 2) }}</td>
                                    <td class="text-end">@angka($baris['total'])</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="3" class="text-start">Total sapronak real</th>
                                <th class="text-end">@angka($real['sapronak']['total'])</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="fs-12 color-gray mt-15 mb-0">Nilai ini dibaca dari RHPP Real yang tersimpan; tidak diganti oleh estimasi master.</p>
            </div>
        @else
            <div class="card-body pt-0">
                <p class="color-gray mb-0">Dokumen RHPP Real belum tersedia untuk periode ini.</p>
            </div>
        @endif
    </div>
</div>
