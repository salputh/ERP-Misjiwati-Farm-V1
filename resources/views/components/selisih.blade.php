@props(['nilai', 'desimal' => 1])

{{-- Selisih persen bertanda: panah naik hijau atau turun merah --}}
<span {{ $attributes->class(['color-success' => $nilai >= 0, 'color-danger' => $nilai < 0]) }}>
    <i @class(['las', 'la-arrow-up' => $nilai >= 0, 'la-arrow-down' => $nilai < 0])></i>
    <strong>@angka(abs($nilai), $desimal)%</strong>
</span>
