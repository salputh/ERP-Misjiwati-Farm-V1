@props(['dana', 'total'])

{{-- Riwayat dana operasional yang masuk ke kas kandang, dengan jumlah kumulatifnya. --}}
<div class="col-12 mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Riwayat dana operasional</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">@angka(count($dana)) kali setoran</div>
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th class="text-end">Jumlah (Rp)</th>
                            <th class="text-end">Kumulatif (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($dana as $setoran)
                            <tr>
                                <td>{{ $setoran['tanggal']->translatedFormat('j F Y') }}</td>
                                <td class="text-end">@angka($setoran['jumlah'])</td>
                                <td class="text-end">@angka($setoran['saldo'])</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="3" class="text-body-secondary">Belum ada dana operasional yang masuk.</td>
                            </tr>
                        @endforelse
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>Total dana masuk</th>
                            <th class="text-end">@angka($total)</th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        
</div>
</section>
</div>
