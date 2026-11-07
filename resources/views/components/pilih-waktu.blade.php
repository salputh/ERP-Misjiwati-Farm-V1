@props(['nilai', 'id', 'kesalahan' => false])

{{-- Pemilih tanggal dan jam Basalt: tanggal dari datepicker Basalt, jam dari input type="time" 24 jam.
     Pengganti input datetime-local bawaan peramban. Nilai berformat Y-m-dTH:i; nilai baru dikirim lewat event "waktu-dipilih". --}}
<div
    {{ $attributes->class(['row g-2']) }}
    x-data="pilihWaktu"
    data-nilai="{{ $nilai }}"
    wire:key="pilih-waktu-{{ $id }}-{{ $nilai }}"
    wire:ignore
>
    <div class="col-7">
        <div class="basalt-datepicker" data-basalt-datepicker x-ref="tanggal">
            <div class="input-group">
                <input type="text" id="{{ $id }}" autocomplete="off" aria-label="Tanggal" placeholder="Pilih tanggal" @class(['form-control', 'is-invalid' => $kesalahan])>
                <button type="button" class="btn btn-outline-secondary basalt-datepicker-btn" aria-label="Buka kalender"><i class="bi bi-calendar3" aria-hidden="true"></i></button>
            </div>
            <input type="hidden" value="{{ \Illuminate\Support\Str::before($nilai, 'T') }}">
        </div>
    </div>
    <div class="col-5">
        <input type="time" id="{{ $id }}-jam" x-ref="jam" aria-label="Jam" step="60" @class(['form-control', 'is-invalid' => $kesalahan]) value="{{ \Illuminate\Support\Str::after($nilai, 'T') === $nilai ? '' : \Illuminate\Support\Str::after($nilai, 'T') }}">
    </div>
</div>
