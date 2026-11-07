@props(['selisih'])

{{-- Selisih persen terhadap standar dari lembar laporan: teks sudah jadi, arah menentukan panah dan warnanya. --}}
<span {{ $attributes->class(['text-success' => $selisih['naik'], 'text-danger' => ! $selisih['naik']]) }}>
    <i @class(['bi', 'bi-arrow-up' => $selisih['naik'], 'bi-arrow-down' => ! $selisih['naik']])></i>
    <strong>{{ $selisih['teks'] }}</strong>
</span>
