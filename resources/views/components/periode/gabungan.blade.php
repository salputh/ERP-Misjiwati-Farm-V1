@props(['periode', 'gabungan'])

{{-- Angka gabungan seluruh kandang pada periode terpilih , label di kiri dan angka di kanan. --}}
<x-kartu judul="Farm / Gabungan" :subjudul="$periode->nama" class="mb-4">
    <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Populasi chick-in</span>
                <span class="fw-medium text-body text-end">@angka($periode->totalDocChickIn()) ekor</span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Kandang berjalan</span>
                <span class="fw-medium text-body text-end">{{ $periode->kandangPeriode->count() }} kandang</span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Pakan diberikan</span>
                <span class="fw-medium text-body text-end">@angka($gabungan['pakan']['terpakai']) zak</span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Stok gudang tercatat</span>
                <span class="fw-medium text-body text-end">
                    @isset($gabungan['pakan']['sisa'])
                        @angka($gabungan['pakan']['sisa'], 1) zak
                    @else
                        Belum tersedia
                    @endisset
                </span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Panen gabungan</span>
                <span class="fw-medium text-body text-end">
                    @if ($gabungan['panen'])
                        @angka($gabungan['panen']['total']['ekor']) ekor
                    @else
                        Belum ada panen
                    @endif
                </span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>RHPP resmi</span>
                <span class="fw-medium text-body text-end">
                    @if ($gabungan['rhpp'])
                        Rp @angka($gabungan['rhpp']['rekap']['bersih'])
                    @else
                        Belum tersedia
                    @endif
                </span>
            </li>
            <li class="list-group-item d-flex justify-content-between gap-3">
                <span>Biaya bersama</span>
                <span class="fw-medium text-body text-end">Belum ada ledger level farm</span>
            </li>
        </ul>
    <a class="btn btn-outline-primary text-primary btn-sm w-100 mt-3" href="{{ route('dashboard', ['periode' => $periode->id]) }}">Lihat ringkasan gabungan</a>
</x-kartu>
