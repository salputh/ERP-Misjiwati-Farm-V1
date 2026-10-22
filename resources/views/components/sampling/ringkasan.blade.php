@props(['hasil', 'pakan', 'denganSexing', 'umur'])

{{-- Ringkasan satu sesi sampling: per kelamin bila dengan sexing, lalu gabungan beserta DG dan FCR. --}}
<div class="row g-4">
    @foreach ($hasil['per_kelamin'] as $kelamin => $ringkasan)
        @if ($denganSexing)
            <div class="col-md-6">
                <x-sampling.kelamin :kelamin="$kelamin" />
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <tbody>
                        <tr><td>Total berat (gram)</td><td class="text-end">@angka($ringkasan['total'])</td></tr>
                        <tr><td>Jumlah line</td><td class="text-end">{{ $ringkasan['jumlah_line'] }}</td></tr>
                        <tr><td>Jumlah titik sampel</td><td class="text-end">{{ $ringkasan['jumlah_titik'] }}</td></tr>
                        <tr><td>Total ekor tersampel</td><td class="text-end">@angka($ringkasan['ekor'])</td></tr>
                        <tr><td><strong>ABW per ekor</strong></td><td class="text-end"><strong>@angka($ringkasan['abw']) g</strong></td></tr>
                    </tbody>
                </table>
            </div>
        @endif
    @endforeach

    <div class="col-12">
        @if ($denganSexing)
            <x-sampling.kelamin kelamin="gabungan">Gabungan jantan dan betina</x-sampling.kelamin>
        @endif
        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
            <tbody>
                <tr><td>Total berat keseluruhan (gram)</td><td class="text-end">@angka($hasil['gabungan']['total'])</td></tr>
                <tr><td>Jumlah line</td><td class="text-end">{{ $hasil['gabungan']['jumlah_line'] }}</td></tr>
                <tr><td>Jumlah titik sampel</td><td class="text-end">{{ $hasil['gabungan']['jumlah_titik'] }} dari {{ $hasil['gabungan']['jumlah_titik_penuh'] }}</td></tr>
                <tr><td>Total ekor tersampel</td><td class="text-end">@angka($hasil['gabungan']['ekor'])</td></tr>
                <tr class="sampling-sorot"><td><strong>ABW per ekor{{ $denganSexing ? ' gabungan' : '' }}</strong></td><td class="text-end"><strong>@angka($hasil['gabungan']['abw']) g</strong></td></tr>
                <tr><td>ABW standar</td><td class="text-end">@angka($hasil['gabungan']['abw_standar']) g</td></tr>
                <tr><td>DG aktual <span class="fs-12 color-gray">(dari ABW sebelumnya @angka($hasil['gabungan']['abw_sebelumnya']) g)</span></td><td class="text-end">@angka($hasil['gabungan']['dg'])</td></tr>
                <tr>
                    <td>
                        DG per hari
                        @if ($hasil['gabungan']['hari'] > 1)
                            <span class="fs-12 color-gray">(jarak {{ $hasil['gabungan']['hari'] }} hari)</span>
                        @endif
                    </td>
                    <td class="text-end">@angka($hasil['gabungan']['dg_per_hari'])</td>
                </tr>
                <tr><td>DG standar</td><td class="text-end">@angka($hasil['gabungan']['dg_standar'])</td></tr>
                <tr>
                    <td>Selisih DG</td>
                    <td @class(['text-end', 'color-danger' => $hasil['gabungan']['selisih_dg'] < 0, 'color-success' => $hasil['gabungan']['selisih_dg'] > 0])>
                        @isset($hasil['gabungan']['selisih_dg'])
                            @kurung($hasil['gabungan']['selisih_dg'])
                        @else
                            -
                        @endisset
                    </td>
                </tr>
                <tr><td>FCR standar</td><td class="text-end">@angka($pakan['fcr_standar'], 3)</td></tr>
                <tr>
                    <td>
                        FCR aktual
                        @if ($pakan['pakan_sampai_umur'] !== null && $pakan['pakan_sampai_umur'] < $umur)
                            <span class="fs-12 color-gray">(pakan tercatat s/d hari ke-{{ $pakan['pakan_sampai_umur'] }})</span>
                        @endif
                    </td>
                    <td class="text-end">@angka($pakan['fcr'], 3)</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
