@props(['stok'])

{{-- Sisa pakan per jenis : kode jenis sebagai tag berwarna, status "Habis"/"Belum dipakai", lalu angkanya. --}}
<div class="table-responsive">
    <table class="table mb-0 db-table">
        <thead>
            <tr>
                <th>Jenis pakan</th>
                <th class="text-end">Sisa (zak)</th>
                <th class="text-end">Masuk</th>
                <th class="text-end">Terpakai</th>
                <th>Pemakaian</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($stok as $satu)
                <tr wire:key="stok-pakan-{{ $satu['jenis'] }}">
                    <td>
                        <span class="badge m-0 bg-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }}-subtle text-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }}">{{ $satu['jenis'] }}</span>
                        @if ($satu['sisa'] === 0.0)
                            <span class="d-block small text-body-secondary mt-1">Habis</span>
                        @elseif ($satu['terpakai'] === 0.0)
                            <span class="d-block small text-body-secondary mt-1">Belum dipakai</span>
                        @endif
                    </td>
                    <td class="text-end">
                        <div class="fw-medium">
                            @isset($satu['sisa'])
                                {{ \App\Support\Format::ringkasKurung($satu['sisa']) }}
                            @else
                                <span class="text-body-secondary small" title="Sisa tidak dihitung karena jenis pakannya tidak dicatat">tidak dihitung</span>
                            @endisset
                        </div>
                    </td>
                    <td class="text-end">{{ \App\Support\Format::ringkasKurung($satu['masuk']) }}</td>
                    <td class="text-end">{{ \App\Support\Format::ringkasKurung($satu['terpakai']) }}</td>
                    <td class="w-25">
                        <div class="d-flex align-items-center mb-0">
                            <div class="progress" role="progressbar" aria-label="Pemakaian {{ $satu['jenis'] }}" aria-valuenow="{{ round($satu['persen_terpakai'] ?? 0) }}" aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar bg-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }} share-{{ max(0, min(100, (int) round($satu['persen_terpakai'] ?? 0))) }}"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" class="text-center text-body-secondary">Belum ada pakan masuk atau pemberian pakan yang dicatat.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
