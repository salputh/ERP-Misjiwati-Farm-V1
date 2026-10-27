@props(['dana', 'total'])

{{-- Riwayat dana operasional yang masuk ke kas kandang, dengan jumlah kumulatifnya. --}}
<div class="col-12 mb-25">
    <div class="card card-default card-md h-100">
        <div class="card-header">
            <h6>Riwayat dana operasional</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">@angka(count($dana)) kali setoran</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Tanggal</span></th>
                            <th class="text-end"><span class="userDatatable-title">Jumlah (Rp)</span></th>
                            <th class="text-end"><span class="userDatatable-title">Kumulatif (Rp)</span></th>
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
                                <td colspan="3" class="color-gray">Belum ada dana operasional yang masuk.</td>
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
    </div>
</div>
