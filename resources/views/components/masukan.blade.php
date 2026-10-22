@props([
    'tipe' => 'text',
    'ukuran' => 'default',
    'ikon' => null,
    'posisiIkon' => 'kiri', // kiri, kanan
    'label' => null,
    'keterangan' => null,
    'kesalahan' => null,
])

@php
    $inputClasses = ['form-control', 'ip-gray'];
    if ($ukuran !== 'default') {
        $inputClasses[] = 'form-control-' . $ukuran;
    } else {
        $inputClasses[] = 'form-control-default';
    }

    if ($kesalahan) {
        $inputClasses[] = 'is-invalid';
    }

    $containerClasses = ['form-group'];
    if ($ikon) {
        $containerClasses[] = 'input-container position-relative';
        $containerClasses[] = $posisiIkon === 'kiri' ? 'icon-left' : 'icon-right';
    }
@endphp

<div {{ $attributes->only('class')->merge(['class' => 'mb-25']) }}>
    @if ($label)
        <label @if($attributes->has('id')) for="{{ $attributes->get('id') }}" @endif class="il-gray fs-14 fw-500 mb-10">{{ $label }}</label>
    @endif

    <div @class($containerClasses)>
        @if ($ikon && $posisiIkon === 'kiri')
            <span class="input-icon icon-left">
                <i class="uil {{ $ikon }}"></i>
            </span>
        @endif

        <input type="{{ $tipe }}" {{ $attributes->except('class')->merge(['class' => implode(' ', $inputClasses)]) }}>

        @if ($ikon && $posisiIkon === 'kanan')
            <span class="input-icon icon-right">
                <i class="uil {{ $ikon }}"></i>
            </span>
        @endif
    </div>

    @if ($kesalahan)
        <div class="invalid-feedback d-block">{{ $kesalahan }}</div>
    @elseif ($keterangan)
        <span class="fs-12 color-gray">{{ $keterangan }}</span>
    @endif
</div>
