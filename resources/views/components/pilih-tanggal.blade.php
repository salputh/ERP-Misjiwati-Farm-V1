@props(['nilai', 'id' => null, 'min' => null, 'maks' => null, 'ukuran' => 'sm', 'kesalahan' => false, 'nonaktif' => false])

{{-- Pemilih tanggal bergaya katalog template (HexaDash: Datepicker, jQuery UI), pengganti input type="date" bawaan peramban.
     Nilai, min, dan maks berformat Y-m-d; tanggal yang dipilih dikirim lewat event "tanggal-dipilih" (detail: Y-m-d).
     ukuran="sm" untuk saringan di kepala kartu, ukuran="medium" untuk isian form selebar kolom (48 px).
     Kuncinya mengikuti nilai, sehingga Livewire memasang ulang pemilih saat tanggal diganti dari server. --}}
<div
    {{ $attributes->class(['form-group-calender', 'pilih-tanggal' => $ukuran === 'sm']) }}
    x-data="pilihTanggal"
    data-nilai="{{ $nilai }}"
    data-min="{{ $min }}"
    data-maks="{{ $maks }}"
    wire:key="pilih-tanggal-{{ $id }}-{{ $nilai }}"
    wire:ignore
>
    <div class="position-relative">
        <input
            type="text"
            @class([
                'form-control',
                'form-control-sm' => $ukuran === 'sm',
                'ih-medium ip-gray radius-xs b-light px-15' => $ukuran === 'medium',
                'is-invalid' => $kesalahan,
            ])
            x-ref="isian"
            readonly
            autocomplete="off"
            @isset($id) id="{{ $id }}" @endisset
            @disabled($nonaktif)
        >
        <a href="#" tabindex="-1" aria-hidden="true"><img src="{{ asset('assets/img/svg/calendar.svg') }}" alt="" class="svg"></a>
    </div>
</div>
