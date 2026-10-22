@props([
    'warna' => 'primary',
    'ukuran' => 'default',
    'tipe' => 'button',
    'bentuk' => 'squared',
    'variasi' => null, // outlined, transparent, shadow
    'blok' => false,
    'ikon' => null,
    'posisiIkon' => 'kiri', // kiri, kanan
])

@php
    $classes = ['btn'];

    // Warna & Variasi, mengikuti katalog template (HexaDash):
    // tombol outline memakai btn-outline-{warna} bersama color-{warna},
    // tombol transparent memakai btn-transparent-{warna}.
    if ($variasi === 'outlined') {
        $classes[] = 'btn-outline-' . $warna;
        $classes[] = 'color-' . $warna;
    } elseif ($variasi === 'transparent') {
        $classes[] = 'btn-transparent-' . $warna;
    } else {
        $classes[] = 'btn-' . $warna;
    }

    // Ukuran
    if ($ukuran !== 'default') {
        $classes[] = 'btn-' . $ukuran;
    } else {
        $classes[] = 'btn-default';
    }

    // Bentuk
    if ($bentuk === 'squared') {
        $classes[] = 'btn-squared';
    } elseif ($bentuk === 'rounded') {
        $classes[] = 'btn-rounded';
    }

    // Shadow
    if ($variasi === 'shadow') {
        $classes[] = 'btn-shadow-' . $warna;
    }

    // Block
    if ($blok) {
        $classes[] = 'btn-block';
    }
@endphp

<button type="{{ $tipe }}" {{ $attributes->merge(['class' => implode(' ', $classes)]) }}>
    @if ($ikon && $posisiIkon === 'kiri')
        <i class="uil {{ $ikon }} @if($slot->isNotEmpty()) me-2 @endif"></i>
    @endif

    {{ $slot }}

    @if ($ikon && $posisiIkon === 'kanan')
        <i class="uil {{ $ikon }} @if($slot->isNotEmpty()) ms-2 @endif"></i>
    @endif
</button>
