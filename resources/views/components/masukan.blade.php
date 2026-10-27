@props([
    'tipe' => 'text',
    'ukuran' => 'medium', // medium (48 px seperti katalog form template) atau sm untuk isian di dalam tabel
    'label' => null,
    'keterangan' => null,
    'kesalahan' => null,
])

{{-- Isian teks bergaya katalog template (HexaDash: Form Elements, form-group + il-gray label + ih-medium). --}}
<div {{ $attributes->only('class')->class(['form-group mb-25']) }}>
    @if ($label)
        <label @if ($attributes->has('id')) for="{{ $attributes->get('id') }}" @endif class="il-gray fs-14 fw-500 align-center mb-10">{{ $label }}</label>
    @endif

    <input type="{{ $tipe }}" {{ $attributes->except('class')->class([
        'form-control ip-gray radius-xs b-light px-15',
        'ih-medium' => $ukuran === 'medium',
        'form-control-sm' => $ukuran === 'sm',
        'is-invalid' => $kesalahan,
    ]) }}>

    @if ($kesalahan)
        <div class="invalid-feedback d-block">{{ $kesalahan }}</div>
    @elseif ($keterangan)
        <small class="d-block mt-1 fs-13 color-light">{{ $keterangan }}</small>
    @endif
</div>
