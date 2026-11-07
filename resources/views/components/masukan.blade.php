@props([
    'tipe' => 'text',
    'ukuran' => 'medium', // medium (bawaan form) atau sm untuk isian di dalam tabel
    'label' => null,
    'keterangan' => null,
    'kesalahan' => null,
])

{{-- Isian teks Basalt (Bootstrap form-control dengan label di atas). --}}
<div {{ $attributes->only('class')->class(['mb-3']) }}>
    @if ($label)
        <label @if ($attributes->has('id')) for="{{ $attributes->get('id') }}" @endif class="form-label">{{ $label }}</label>
    @endif

    <input type="{{ $tipe }}" {{ $attributes->except('class')->class([
        'form-control',
        'form-control-sm' => $ukuran === 'sm',
        'is-invalid' => $kesalahan,
    ]) }}>

    @if ($kesalahan)
        <div class="invalid-feedback d-block">{{ $kesalahan }}</div>
    @elseif ($keterangan)
        <div class="form-text">{{ $keterangan }}</div>
    @endif
</div>
