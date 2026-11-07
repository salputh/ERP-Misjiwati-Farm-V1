@props(['pemodal', 'sisaAkhir'])

{{-- Rincian bagi hasil keuntungan atau pengembalian modal: sisa akhir dibagi menurut porsi tiap pemodal. --}}
<div class="col-12 order-4 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Bagi hasil pemodal</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">keuntungan atau pengembalian modal</div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0 db-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Pemodal</th>
                            <th class="text-end">Porsi</th>
                            <th class="text-end">Jumlah (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($pemodal['penerima'] as $satu)
                            <tr>
                                <td>{{ $loop->iteration }}</td>
                                <td>{{ $satu['nama'] }}</td>
                                <td class="text-end recording-masukan">{{ \App\Support\Format::persen($satu['persen']) }}</td>
                                <td @class(['text-end', 'text-danger' => $satu['jumlah'] < 0])>@kurung($satu['jumlah'])</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="4" class="text-body-secondary">Porsi pemodal kandang ini belum diisi.</td>
                            </tr>
                        @endforelse
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="2">Jumlah</th>
                            <th class="text-end">{{ \App\Support\Format::persen($pemodal['persen']) }}</th>
                            <th @class(['text-end', 'text-danger' => $pemodal['total'] < 0])>@kurung($pemodal['total'])</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p class="small text-body-secondary mt-3 mb-0">
                Tiap pemodal menerima porsinya dari sisa akhir Rp @kurung($sisaAkhir), dibulatkan ke rupiah; pemodal terakhir menerima sisanya supaya jumlahnya tepat.
            </p>
        
</div>
</section>
</div>
