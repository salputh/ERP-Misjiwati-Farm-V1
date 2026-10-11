@props(['selisih'])

{{-- Selisih persen terhadap standar dari lembar laporan: teks sudah jadi, arah menentukan panah dan warnanya. --}}
<span {{ $attributes->class(['color-success' => $selisih['naik'], 'color-danger' => ! $selisih['naik']]) }}>
    <i @class(['las', 'la-arrow-up' => $selisih['naik'], 'la-arrow-down' => ! $selisih['naik']])></i>
    <strong>{{ $selisih['teks'] }}</strong>
</span>
