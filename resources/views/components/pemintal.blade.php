@props(['ukuran' => 'sm'])

{{-- Pemintal Basalt (spinner-border Bootstrap). Ukuran: sm, md, atau lg. --}}
<div {{ $attributes->class(['spinner-border text-primary', 'spinner-border-sm' => $ukuran === 'sm', 'pemintal-lg' => $ukuran === 'lg']) }} role="status">
    <span class="visually-hidden">Memuat…</span>
</div>
