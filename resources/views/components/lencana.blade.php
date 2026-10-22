@props([
    'warna' => 'primary',
    'tipe' => 'default', // default, dot, icon
    'ukuran' => 'default', // sm, default
    'lingkaran' => false,
])

@php
    $classes = ['badge'];
    
    if ($tipe === 'dot') {
        $classes[] = 'badge-dot';
        $classes[] = 'dot-' . $warna;
    } else {
        $classes[] = 'badge-' . $warna;
    }
    
    if ($ukuran === 'sm') {
        $classes[] = 'badge-sm';
    }
    
    if ($lingkaran) {
        $classes[] = 'rounded-circle';
    }
@endphp

<span {{ $attributes->merge(['class' => implode(' ', $classes)]) }}>
    {{ $slot }}
</span>
