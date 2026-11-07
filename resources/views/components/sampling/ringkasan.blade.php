@props(['hasil', 'pakan', 'denganSexing', 'umur'])

{{-- Ringkasan satu sesi sampling: per kelamin bila dengan sexing, lalu gabungan beserta DG dan FCR. --}}
<div class="row g-4">
    @foreach ($hasil['per_kelamin'] as $kelamin => $ringkasan)
        @if ($denganSexing)
            <div class="col-md-6">
                <x-sampling.kelamin :kelamin="$kelamin" />
                <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between gap-3"><span>Total berat (gram)</span><span class="text-end text-body">@angka($ringkasan['total'])</span></li>
                        <li class="list-group-item d-flex justify-content-between gap-3"><span>Jumlah line</span><span class="text-end text-body">{{ $ringkasan['jumlah_line'] }}</span></li>
                        <li class="list-group-item d-flex justify-content-between gap-3"><span>Jumlah titik sampel</span><span class="text-end text-body">{{ $ringkasan['jumlah_titik'] }}</span></li>
                        <li class="list-group-item d-flex justify-content-between gap-3"><span>Total ekor tersampel</span><span class="text-end text-body">@angka($ringkasan['ekor'])</span></li>
                        <li class="list-group-item d-flex justify-content-between gap-3"><span><strong>ABW per ekor</strong></span><span class="text-end text-body"><strong>@angka($ringkasan['abw']) g</strong></span></li>
                    </ul>
            </div>
        @endif
    @endforeach

    <div class="col-12">
        @if ($denganSexing)
            <x-sampling.kelamin kelamin="gabungan">Gabungan jantan dan betina</x-sampling.kelamin>
        @endif
        <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between gap-3"><span>Total berat keseluruhan (gram)</span><span class="text-end text-body">@angka($hasil['gabungan']['total'])</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>Jumlah line</span><span class="text-end text-body">{{ $hasil['gabungan']['jumlah_line'] }}</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>Jumlah titik sampel</span><span class="text-end text-body">{{ $hasil['gabungan']['jumlah_titik'] }} dari {{ $hasil['gabungan']['jumlah_titik_penuh'] }}</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>Total ekor tersampel</span><span class="text-end text-body">@angka($hasil['gabungan']['ekor'])</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3 bg-primary-subtle text-body"><span><strong>ABW per ekor{{ $denganSexing ? ' gabungan' : '' }}</strong></span><span class="text-end text-primary"><strong>@angka($hasil['gabungan']['abw']) g</strong></span></li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>ABW standar</span><span class="text-end text-body">@angka($hasil['gabungan']['abw_standar']) g</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>DG aktual <span class="small text-body-secondary">(dari ABW sebelumnya @angka($hasil['gabungan']['abw_sebelumnya']) g)</span></span><span class="text-end text-body">@angka($hasil['gabungan']['dg'])</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3">
                    <span>
                        DG per hari
                        @if ($hasil['gabungan']['hari'] > 1)
                            <span class="small text-body-secondary">(jarak {{ $hasil['gabungan']['hari'] }} hari)</span>
                        @endif
                    </span>
                    <span class="text-end text-body">@angka($hasil['gabungan']['dg_per_hari'])</span>
                </li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>DG standar</span><span class="text-end text-body">@angka($hasil['gabungan']['dg_standar'])</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3">
                    <span>Selisih DG</span>
                    <span @class(['text-end text-body', 'text-danger' => $hasil['gabungan']['selisih_dg'] < 0, 'text-success' => $hasil['gabungan']['selisih_dg'] > 0])>
                        @isset($hasil['gabungan']['selisih_dg'])
                            @kurung($hasil['gabungan']['selisih_dg'])
                        @else
                            -
                        @endisset
                    </span>
                </li>
                <li class="list-group-item d-flex justify-content-between gap-3"><span>FCR standar</span><span class="text-end text-body">@angka($pakan['fcr_standar'], 3)</span></li>
                <li class="list-group-item d-flex justify-content-between gap-3">
                    <span>
                        FCR aktual
                        @if ($pakan['pakan_sampai_umur'] !== null && $pakan['pakan_sampai_umur'] < $umur)
                            <span class="small text-body-secondary">(pakan tercatat s/d hari ke-{{ $pakan['pakan_sampai_umur'] }})</span>
                        @endif
                    </span>
                    <span class="text-end text-body">@angka($pakan['fcr'], 3)</span>
                </li>
            </ul>
    </div>
</div>
