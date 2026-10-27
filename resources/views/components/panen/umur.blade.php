@props(['umur', 'total', 'umurRata'])

{{-- Umur panen per tanggal mulai timbang; rata-ratanya tertimbang jumlah ekor dan dipakai di perhitungan IP. --}}
<div class="col-xxl-5 mb-25">
    <x-kartu judul="Umur panen per tanggal" class="h-100" badan="p-0">
        <div class="table4 p-25">
            <div class="table-responsive">
                <table class="table tabel-rapat text-nowrap mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Tanggal</span></th>
                            <th class="text-end"><span class="userDatatable-title">Umur</span></th>
                            <th class="text-end"><span class="userDatatable-title">Nota</span></th>
                            <th class="text-end"><span class="userDatatable-title">Ekor</span></th>
                            <th class="text-end"><span class="userDatatable-title">Berat (kg)</span></th>
                            <th class="text-end"><span class="userDatatable-title">BW (kg)</span></th>
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
    </x-kartu>
</div>
