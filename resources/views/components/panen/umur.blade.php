@props(['umur', 'total', 'umurRata'])

{{-- Umur panen per tanggal mulai timbang; rata-ratanya tertimbang jumlah ekor dan dipakai di perhitungan IP. --}}
<div class="col-xxl-5 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Umur panen per tanggal</h6>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th class="text-end">Umur</th>
                            <th class="text-end">Nota</th>
                            <th class="text-end">Ekor</th>
                            <th class="text-end">Berat (kg)</th>
                            <th class="text-end">BW (kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($umur as $sehari)
                            <tr>
                                <td>{{ $sehari['tanggal']->translatedFormat('j F Y') }}</td>
                                <td class="text-end">{{ $sehari['umur'] }} hari</td>
                                <td class="text-end">@angka($sehari['jumlah_nota'])</td>
                                <td class="text-end">@angka($sehari['ekor'])</td>
                                <td class="text-end">@angka($sehari['berat'], 2)</td>
                                <td class="text-end">@angka($sehari['bw'], 2)</td>
                            </tr>
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>Total</th>
                            <th class="text-end">@angka($umurRata, 1) hari</th>
                            <th class="text-end">@angka($total['jumlah_nota'])</th>
                            <th class="text-end">@angka($total['ekor'])</th>
                            <th class="text-end">@angka($total['berat'], 2)</th>
                            <th class="text-end">@angka($total['bw'], 2)</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>
