@props(['nilai', 'id' => null, 'min' => null, 'maks' => null, 'ukuran' => 'sm', 'kesalahan' => false, 'nonaktif' => false])

{{-- Pemilih tanggal Basalt (assets/basalt/js/components/datepicker.js), pengganti input type="date" bawaan peramban.
     Nilai, min, dan maks berformat Y-m-d; tanggal yang dipilih dikirim lewat event "tanggal-dipilih" (detail: Y-m-d).
     ukuran="sm" untuk saringan di kepala kartu, ukuran="medium" untuk isian form selebar kolom.
     Kuncinya mengikuti nilai, sehingga Livewire memasang ulang pemilih saat tanggal diganti dari server. --}}
<div
    {{ $attributes->class(['basalt-datepicker', 'pilih-tanggal' => $ukuran === 'sm']) }}
    data-basalt-datepicker
    @if ($min) data-min="{{ $min }}" @endif
    @if ($maks) data-max="{{ $maks }}" @endif
    x-data="pilihTanggal"
    data-nilai="{{ $nilai }}"
    wire:key="pilih-tanggal-{{ $id }}-{{ $nilai }}"
    wire:ignore
>
    <div @class(['input-group', 'input-group-sm' => $ukuran === 'sm'])>
        <input
            type="text"
            @class(['form-control', 'is-invalid' => $kesalahan])
            autocomplete="off"
            placeholder="Pilih tanggal"
            @isset($id) id="{{ $id }}" @endisset
            @disabled($nonaktif)
        >
        <button type="button" class="btn btn-outline-secondary basalt-datepicker-btn" aria-label="Buka kalender" @disabled($nonaktif)><i class="bi bi-calendar3" aria-hidden="true"></i></button>
    </div>
    <input type="hidden" value="{{ $nilai }}">
</div>
