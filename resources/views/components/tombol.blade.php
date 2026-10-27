@props([
    'warna' => 'primary',
    'ukuran' => 'sm', // xs, sm, default, md, lg
    'tipe' => 'button',
    'variasi' => null, // outlined, transparent
    'blok' => false,
    'ikon' => null,
])

{{-- Tombol bergaya katalog template (HexaDash: Button). Bentuk selalu squared seperti contoh template;
     outline memakai btn-outline-{warna} bersama color-{warna}, light color memakai btn-transparent-{warna}. --}}
<button type="{{ $tipe }}" {{ $attributes->class([
    'btn btn-squared',
    'btn-'.$warna => $variasi === null,
    'btn-outline-'.$warna.' color-'.$warna => $variasi === 'outlined',
    'btn-transparent-'.$warna => $variasi === 'transparent',
    'btn-'.$ukuran,
    'btn-block' => $blok,
]) }}>
    @if ($ikon)
        <i class="uil {{ $ikon }}" aria-hidden="true"></i>
    @endif
    {{ $slot }}
</button>
