@props(['dana', 'total'])

{{-- Riwayat dana operasional yang masuk ke kas kandang, dengan jumlah kumulatifnya. --}}
<div class="col-12 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Riwayat dana operasional</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">@angka(count($dana)) kali setoran</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
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
