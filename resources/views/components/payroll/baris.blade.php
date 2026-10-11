@props(['baris'])

{{-- Satu baris slip gaji: label dengan cara menghitung atau keterangannya, lalu jumlah. Nol ditulis sebagai tanda hubung. --}}
<tr>
    <td>
        {{ $baris['label'] }}
        @isset($baris['rumus'])
            <span class="d-block fs-12 color-gray">{{ $baris['rumus'] }}</span>
        @endisset
    </td>
    <td @class(['text-end', 'color-gray' => $baris['jumlah'] === 0])>@angka($baris['jumlah'] ?: null)</td>
</tr>
