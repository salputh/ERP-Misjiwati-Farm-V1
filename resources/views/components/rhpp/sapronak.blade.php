@props(['simulasi', 'real'])

<div class="col-12 mb-4">
    <x-peringatan warna="info" judul="Perhitungan otomatis biaya sapronak">Estimasi menggunakan populasi DOC pada periode, pemakaian pakan per jenis, harga master pakan terkini, dan biaya OVK dari dokumen RHPP inti. Pembelian Obat Ayam di Kas Operasional tetap menjadi biaya operasional kandang dan tidak dihitung sebagai OVK.</x-peringatan>
</div>

@if ($simulasi['kekurangan'])
    <div class="col-12 mb-4">
        <x-peringatan warna="warning">
            Biaya sapronak belum lengkap: {{ implode(' ', $simulasi['kekurangan']) }}
        </x-peringatan>
    </div>
@endif

<div class="col-lg-6 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Estimasi otomatis dari data periode</h2></div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Komponen / kandang</th>
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
                                    <span class="d-block small text-body-secondary">{{ $baris['kandang'] }}</span>
                                    @if ($baris['masalah'])
                                        <span class="d-block small text-danger">{{ $baris['masalah'] }}</span>
                                    @endif
                                </td>
                                <td class="text-end text-nowrap">
                                    @angka($baris['zak'], 2) zak
                                    @if ($baris['kg'] !== null)
                                        <span class="d-block small text-body-secondary">@angka($baris['kg'], 2) kg</span>
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
                            <tr><td colspan="4" class="text-center text-body-secondary">Belum ada catatan pemberian pakan.</td></tr>
                        @endforelse
                        @foreach ($simulasi['ovk']['baris'] as $baris)
                            <tr>
                                <td>OVK · {{ $baris['kandang'] }} <span class="d-block small text-body-secondary">Dokumen RHPP inti, dibagi menurut DOC</span></td>
                                <td class="text-end">—</td>
                                <td class="text-end">—</td>
                                <td class="text-end">@angka($baris['total'])</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3">Total sapronak simulasi</th>
                            <th class="text-end">{{ $simulasi['total'] === null ? 'Belum lengkap' : \App\Support\Format::angka($simulasi['total']) }}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p class="small text-body-secondary mt-3 mb-0">Harga pakan memakai master terkini, bukan harga historis pembelian. Perbarui harga pada Master Data untuk menyesuaikan estimasi.</p>
        
</div>
</section>
</div>

<div class="col-lg-6 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
        <header class="db-card-head">
<div><h2 class="db-card-title">Realisasi dari dokumen RHPP inti</h2></div>
</header>
        @if ($real)
            <div>
                <div class="tabel-data table-responsive">
                    <table class="table tabel-laporan mb-0 db-table">
                        <thead>
                            <tr>
                                <th>Uraian</th>
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
                                <th colspan="3">Total sapronak real</th>
                                <th class="text-end">@angka($real['sapronak']['total'])</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="small text-body-secondary mt-3 mb-0">Nilai ini dibaca dari RHPP Real yang tersimpan; tidak diganti oleh estimasi master.</p>
            </div>
        @else
            <div>
                <p class="text-body-secondary mb-0">Dokumen RHPP Real belum tersedia untuk periode ini.</p>
            </div>
        @endif
    </div>
</section>
</div>
