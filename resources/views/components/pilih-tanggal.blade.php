@props(['nilai', 'min' => null, 'maks' => null])

{{-- Pemilih tanggal bergaya template (jQuery UI datepicker), pengganti input type="date" bawaan peramban.
     Nilai, min, dan maks berformat Y-m-d; tanggal yang dipilih dikirim lewat event "tanggal-dipilih" (detail: Y-m-d).
     Kuncinya mengikuti nilai, sehingga Livewire memasang ulang pemilih saat tanggal diganti dari server. --}}
<div
    {{ $attributes->class(['pilih-tanggal form-group-calender position-relative']) }}
    x-data="pilihTanggal"
    data-nilai="{{ $nilai }}"
    data-min="{{ $min }}"
    data-maks="{{ $maks }}"
    wire:key="pilih-tanggal-{{ $nilai }}"
    wire:ignore
>
    <input type="text" class="form-control form-control-sm" x-ref="isian" readonly autocomplete="off">
    <a href="#" tabindex="-1" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    </a>
</div>
