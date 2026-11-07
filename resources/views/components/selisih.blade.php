@props(['nilai', 'desimal' => 1])

{{-- Selisih persen bertanda: panah naik hijau atau turun merah --}}
<span {{ $attributes->class(['text-success' => $nilai >= 0, 'text-danger' => $nilai < 0]) }}>
    <i @class(['bi', 'bi-arrow-up' => $nilai >= 0, 'bi-arrow-down' => $nilai < 0])></i>
    <strong>@angka(abs($nilai), $desimal)%</strong>
</span>
