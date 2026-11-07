@props(['label', 'nama', 'ukuran' => 'sm', 'bentuk' => 'tombol', 'kesalahan' => false, 'nonaktif' => false])

{{-- Pilihan tunggal bergaya Basalt (dropdown Bootstrap), pengganti <select> bawaan peramban. Slot berisi butir .dropdown-item (tautan atau tombol).
     bentuk="tombol": tombol dropdown untuk saringan di kepala halaman atau kartu.
     bentuk="isian": tampilan select di dalam form (lebar penuh, panah bawah); butirnya biasanya tombol wire:click="$set('properti', nilai)". --}}
@if ($bentuk === 'isian')
    <div {{ $attributes->class(['pilih pilih--isian dropdown d-block']) }}>
        <button
            type="button"
            @class(['form-select text-start w-100', 'is-invalid' => $kesalahan])
            data-bs-toggle="dropdown"
            x-data="pilihIsian"
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-label="{{ $nama }}"
            @disabled($nonaktif)
        >{{ $label }}</button>
        <div class="dropdown-menu">
            {{ $slot }}
        </div>
    </div>
@else
    <div {{ $attributes->class(['pilih dropdown']) }}>
        <button type="button" class="btn btn-outline-secondary btn-{{ $ukuran }} dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="{{ $nama }}: {{ $label }}" @disabled($nonaktif)>{{ $label }}</button>
        <div class="dropdown-menu">
            {{ $slot }}
        </div>
    </div>
@endif
