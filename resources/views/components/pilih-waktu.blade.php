@props(['nilai', 'id', 'kesalahan' => false])

{{-- Pemilih tanggal dan jam bergaya katalog template: tanggal dari Datepicker (jQuery UI), jam dari Timepicker (wickedpicker).
     Pengganti input datetime-local bawaan peramban. Nilai berformat Y-m-dTH:i; nilai baru dikirim lewat event "waktu-dipilih". --}}
<div
    {{ $attributes->class(['row g-2']) }}
    x-data="pilihWaktu"
    data-nilai="{{ $nilai }}"
    wire:key="pilih-waktu-{{ $id }}-{{ $nilai }}"
    wire:ignore
>
    <div class="col-7">
        <div class="form-group-calender position-relative">
            <input type="text" id="{{ $id }}" x-ref="tanggal" readonly autocomplete="off" aria-label="Tanggal" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $kesalahan])>
            <a href="#" tabindex="-1" aria-hidden="true"><img src="{{ asset('assets/img/svg/calendar.svg') }}" alt="" class="svg"></a>
        </div>
    </div>
    <div class="col-5">
        <div>
            <div class="input-container icon-right position-relative">
                <span class="input-icon icon-right"><img src="{{ asset('assets/img/svg/clock.svg') }}" alt="" class="svg"></span>
                <input type="text" id="{{ $id }}-jam" x-ref="jam" readonly autocomplete="off" aria-label="Jam" placeholder="Jam" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $kesalahan])>
            </div>
        </div>
    </div>
</div>
