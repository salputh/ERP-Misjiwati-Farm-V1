@props(['ukuran' => 'sm'])

{{-- Spinner bawaan template (HexaDash: dm-spin-dots). Ukuran: sm, md, atau lg. --}}
<div {{ $attributes->class(['dm-spin-dots', 'spin-'.$ukuran]) }}>
    <span class="spin-dot badge-dot dot-primary"></span>
    <span class="spin-dot badge-dot dot-primary"></span>
    <span class="spin-dot badge-dot dot-primary"></span>
    <span class="spin-dot badge-dot dot-primary"></span>
</div>
