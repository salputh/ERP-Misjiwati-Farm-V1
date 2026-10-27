@props(['gabungan'])

{{-- Ringkasan sampling seluruh kandangs dalam periode, memakai sesi terbaru tiap kandangs:
     jumlah titik, ekor, ABW tertimbang, dan pakan standar terhadap aktual. --}}
<div class="table-responsive">
<table class="table mb-0">
    <thead>
        <tr class="userDatatable-header">
            <th><span class="userDatatable-title">Kandang</span></th>
            <th class="text-end"><span class="userDatatable-title">Sesi terakhir</span></th>
            <th class="text-end"><span class="userDatatable-title">Usia</span></th>
            <th class="text-end"><span class="userDatatable-title">Titik</span></th>
            <th class="text-end"><span class="userDatatable-title">Ekor</span></th>
            <th class="text-end"><span class="userDatatable-title">ABW</span></th>
            <th class="text-end"><span class="userDatatable-title">Standar (zak)</span></th>
            <th class="text-end"><span class="userDatatable-title">Aktual (zak)</span></th>
            <th></th>
        </tr>
    </thead>
    <tbody>
        @foreach ($gabungan['kandang'] as $baris)
            <tr wire:key="ringkasan-kandang-{{ $baris['periode_kandang_id'] }}">
                <td class="fw-500 color-dark">
                    {{ $baris['kandang'] }}
                    @if ($baris['terpilih'])
                        <span class="dm-tag tag-transparented tag-primary my-0 ms-1">dipilih</span>
                    @endif
                    @unless ($baris['ada_sesi'])
                        <span class="d-block fs-12 color-light">belum ada sampling</span>
                    @endunless
                </td>
                <td class="text-end">
                    @if ($baris['ada_sesi'])
                        {{ $baris['tanggal']->translatedFormat('j M Y') }}
                    @else
                        -
                    @endif
                </td>
                <td class="text-end">{{ $baris['umur'] }} hari</td>
                <td class="text-end">{{ $baris['titik'] }}</td>
                <td class="text-end">@angka($baris['ekor'])</td>
                <td class="text-end">@angka($baris['abw']) g</td>
                <td class="text-end">@angka($baris['zak_standar'])</td>
                <td class="text-end">@angka($baris['zak'])</td>
                <td class="text-end">
                    @if ($baris['ada_sesi'])
                        <x-aksi.ikon :aksi="[
                            ['kelas' => 'view', 'label' => 'Lihat sampling terakhir '.$baris['kandang'].' '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'lihatTerakhir('.$baris['periode_kandang_id'].')', 'modal' => '#modal-riwayat-sampling'],
                        ]" />
                    @endif
                </td>
            </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <th colspan="3">Gabungan</th>
            <th class="text-end">{{ $gabungan['total']['titik'] }}</th>
            <th class="text-end">@angka($gabungan['total']['ekor'])</th>
            <th class="text-end">@angka($gabungan['total']['abw']) g</th>
            <th colspan="3"></th>
        </tr>
    </tfoot>
</table>
</div>
