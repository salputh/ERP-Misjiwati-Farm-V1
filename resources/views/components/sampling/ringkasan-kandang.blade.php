@props(['gabungan'])

{{-- Ringkasan sampling seluruh kandangs dalam periode, memakai sesi terbaru tiap kandangs:
     jumlah titik, ekor, ABW tertimbang, dan pakan standar terhadap aktual. --}}
<table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
    <thead>
        <tr>
            <th>Kandang</th>
            <th class="text-end">Sesi terakhir</th>
            <th class="text-end">Usia</th>
            <th class="text-end">Titik</th>
            <th class="text-end">Ekor</th>
            <th class="text-end">ABW</th>
            <th class="text-end">Standar (zak)</th>
            <th class="text-end">Aktual (zak)</th>
            <th></th>
        </tr>
    </thead>
    <tbody>
        @foreach ($gabungan['kandang'] as $baris)
            <tr wire:key="ringkasan-kandang-{{ $baris['periode_kandang_id'] }}">
                <td>
                    {{ $baris['kandang'] }}
                    @if ($baris['terpilih'])
                        <span class="dm-tag tag-transparented m-0 tag-primary">dipilih</span>
                    @endif
                    @unless ($baris['ada_sesi'])
                        <span class="d-block fs-12 color-gray">belum ada sampling</span>
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
                            ['kelas' => 'view', 'label' => 'Buka sampling '.$baris['kandang'].' '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'bukaSesi('.$baris['periode_kandang_id'].', \''.$baris['tanggal']->format('Y-m-d').'\')'],
                        ]" />
                    @endif
                </td>
            </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <th colspan="4">Gabungan</th>
            <th class="text-end">{{ $gabungan['total']['titik'] }}</th>
            <th class="text-end">@angka($gabungan['total']['ekor'])</th>
            <th class="text-end">@angka($gabungan['total']['abw']) g</th>
            <th colspan="3"></th>
        </tr>
    </tfoot>
</table>
