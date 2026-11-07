@props([
    'warna' => 'primary',
    'ukuran' => 'sm', // xs, sm, default, md, lg
    'tipe' => 'button',
    'variasi' => null, // outlined, transparent
    'blok' => false,
    'ikon' => null,
])

{{-- Tombol Basalt (Bootstrap btn). "light" dipetakan ke secondary karena Basalt memakai nada netral itu untuk aksi pendukung.
     outlined memakai btn-outline-{warna}; transparent memakai btn-link. --}}
@php
    $nada = $warna === 'light' ? 'secondary' : $warna;
    $ukuranBootstrap = match ($ukuran) { 'xs', 'sm' => 'btn-sm', 'lg' => 'btn-lg', default => '' };
@endphp
<button type="{{ $tipe }}" {{ $attributes->class([
    'btn',
    'btn-'.$nada => $variasi === null,
    'btn-outline-'.$nada => $variasi === 'outlined',
    'btn-link text-'.$nada => $variasi === 'transparent',
    $ukuranBootstrap,
    'w-100' => $blok,
]) }}>
    @if ($ikon)
        <i class="bi {{ $ikon }} me-1" aria-hidden="true"></i>
    @endif
    {{ $slot }}
</button>
