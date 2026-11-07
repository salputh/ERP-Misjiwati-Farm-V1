@props(['nilai', 'label', 'ikon', 'warna' => 'primary', 'lebar' => 'col-xxl-6 col-sm-6'])

{{-- Kartu ringkasan Basalt (card basalt-box db-kpi, gaya dashboard Basalt). Slot berisi keterangan di bawah angka.
     Nada ikon mengikuti palet; success/warning/danger hanya untuk status yang memang bermakna itu. --}}
@php
    $nada = match ($warna) {
        'primary' => 'db-tone-1',
        'info' => 'db-tone-2',
        'secondary' => 'db-tone-4',
        'success' => 'kpi-tone-success',
        'warning' => 'kpi-tone-warning',
        'danger' => 'kpi-tone-danger',
        default => 'db-tone-7',
    };
@endphp
<div {{ $attributes->class([$lebar, 'mb-4']) }}>
    <div class="card basalt-box db-kpi h-100">
        <div class="db-kpi-body pb-4">
            <div class="db-kpi-head">
                <p class="db-kpi-label">{{ $label }}</p>
                <span aria-hidden="true" class="db-kpi-icon {{ $nada }}"><i class="bi {{ $ikon }}"></i></span>
            </div>
            <p class="db-kpi-value">{{ $nilai }}</p>
            <div class="db-kpi-change">
                {{ $slot }}
            </div>
        </div>
    </div>
</div>
