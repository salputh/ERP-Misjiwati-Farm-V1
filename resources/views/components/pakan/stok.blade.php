@props(['stok'])

@php
    use App\Support\Format;
@endphp

{{-- Sisa pakan per jenis: kode jenis sebagai tag, status "Habis"/"Belum dipakai", lalu angkanya. --}}
<div class="table-responsive">
    <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
        <thead>
            <tr>
                <th>Jenis pakan</th>
                <th class="text-end">Sisa (zak)</th>
                <th class="text-end">Masuk</th>
                <th class="text-end">Terpakai</th>
                <th class="pakan-stok__pemakaian">Pemakaian</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($stok as $satu)
                <tr wire:key="stok-pakan-{{ $satu['jenis'] }}" style="--warna: var(--color-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }})">
                    <td>
                        <span class="dm-tag m-0">{{ $satu['jenis'] }}</span>
                        @if ($satu['sisa'] === 0.0)
                            <span class="pakan-stok__status">Habis</span>
                        @elseif ($satu['terpakai'] === 0.0)
                            <span class="pakan-stok__status">Belum dipakai</span>
                        @endif
                    </td>
                    <td class="text-end fw-600">
                        @isset($satu['sisa'])
                            {{ Format::ringkasKurung($satu['sisa']) }}
                        @else
                            <span class="color-gray fs-12" title="Sisa tidak dihitung karena jenis pakannya tidak dicatat">tidak dihitung</span>
                        @endisset
                    </td>
                    <td class="text-end">{{ Format::ringkasKurung($satu['masuk']) }}</td>
                    <td class="text-end">{{ Format::ringkasKurung($satu['terpakai']) }}</td>
                    <td class="pakan-stok__pemakaian">
                        <div
                            class="progress"
                            role="progressbar"
                            aria-label="Pemakaian {{ $satu['jenis'] }}"
                            aria-valuenow="{{ round($satu['persen_terpakai'] ?? 0) }}"
                            aria-valuemin="0"
                            aria-valuemax="100">
                            <div class="progress-bar" style="width: {{ $satu['persen_terpakai'] ?? 0 }}%"></div>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" class="color-gray">Belum ada pakan masuk atau pemberian pakan yang dicatat.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
