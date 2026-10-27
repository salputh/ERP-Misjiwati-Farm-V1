@props(['stok'])

{{-- Sisa pakan per jenis (HexaDash: Basic Table): kode jenis sebagai tag berwarna, status "Habis"/"Belum dipakai", lalu angkanya. --}}
<div class="table-responsive">
    <table class="table mb-0">
        <thead>
            <tr class="userDatatable-header">
                <th><span class="userDatatable-title">Jenis pakan</span></th>
                <th class="text-end"><span class="userDatatable-title">Sisa (zak)</span></th>
                <th class="text-end"><span class="userDatatable-title">Masuk</span></th>
                <th class="text-end"><span class="userDatatable-title">Terpakai</span></th>
                <th><span class="userDatatable-title">Pemakaian</span></th>
            </tr>
        </thead>
        <tbody>
            @forelse ($stok as $satu)
                <tr wire:key="stok-pakan-{{ $satu['jenis'] }}">
                    <td>
                        <span class="dm-tag tag-transparented m-0 tag-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }}">{{ $satu['jenis'] }}</span>
                        @if ($satu['sisa'] === 0.0)
                            <span class="d-block fs-12 color-light mt-1">Habis</span>
                        @elseif ($satu['terpakai'] === 0.0)
                            <span class="d-block fs-12 color-light mt-1">Belum dipakai</span>
                        @endif
                    </td>
                    <td class="text-end">
                        <div class="userDatatable-content fw-500">
                            @isset($satu['sisa'])
                                {{ \App\Support\Format::ringkasKurung($satu['sisa']) }}
                            @else
                                <span class="color-light fs-12" title="Sisa tidak dihitung karena jenis pakannya tidak dicatat">tidak dihitung</span>
                            @endisset
                        </div>
                    </td>
                    <td class="text-end"><div class="userDatatable-content">{{ \App\Support\Format::ringkasKurung($satu['masuk']) }}</div></td>
                    <td class="text-end"><div class="userDatatable-content">{{ \App\Support\Format::ringkasKurung($satu['terpakai']) }}</div></td>
                    <td class="w-25">
                        <div class="progress-wrap d-flex align-items-center mb-0">
                            <div class="progress" role="progressbar" aria-label="Pemakaian {{ $satu['jenis'] }}" aria-valuenow="{{ round($satu['persen_terpakai'] ?? 0) }}" aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar bg-{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }}" style="width: {{ $satu['persen_terpakai'] ?? 0 }}%"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" class="text-center color-light">Belum ada pakan masuk atau pemberian pakan yang dicatat.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
