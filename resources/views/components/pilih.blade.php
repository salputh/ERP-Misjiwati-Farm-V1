@props(['label', 'nama', 'ukuran' => 'sm', 'bentuk' => 'tombol', 'kesalahan' => false, 'nonaktif' => false])

{{-- Pilihan tunggal bergaya template, pengganti <select> bawaan peramban. Slot berisi butir .dropdown-item (tautan atau tombol).
     bentuk="tombol": "Button with dropdown menu" template, untuk saringan di kepala halaman atau kartu.
     bentuk="isian": tampilan select di katalog Form Elements template (48 px, panah bawah), untuk isian di dalam form;
     butirnya biasanya tombol wire:click="$set('properti', nilai)". --}}
@if ($bentuk === 'isian')
    <div {{ $attributes->class(['pilih pilih--isian dropdown d-block']) }}>
        <button
            type="button"
            @class(['form-control ih-medium ip-gray radius-xs b-light px-15 d-flex align-items-center justify-content-between w-100 text-start', 'is-invalid' => $kesalahan])
            data-bs-toggle="dropdown"
            x-data="pilihIsian"
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-label="{{ $nama }}"
            @disabled($nonaktif)
        >
            <span>{{ $label }}</span>
            <i class="uil uil-angle-down color-light" aria-hidden="true"></i>
        </button>
        {{-- dropdown-menu--dynamic: pengecualian template agar posisi menu diatur Popper. Popper memakai posisi fixed (Alpine pilihIsian),
             sehingga menu tidak terpotong modal yang pendek atau bisa digulir dan bisa membuka ke atas bila ruang di bawah kurang. --}}
        <div class="dropdown-default dropdown-menu dropdown-menu--dynamic">
            {{ $slot }}
        </div>
    </div>
@else
    <div {{ $attributes->class(['pilih dropdown dropdown-click']) }}>
        <div class="btn-group" role="group" aria-label="{{ $nama }}">
            <button type="button" class="btn btn-outline-lighten btn-{{ $ukuran }}" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" @disabled($nonaktif)>{{ $label }}</button>
            <button type="button" class="btn btn-outline-lighten btn-{{ $ukuran }} dropdown-toggle-split" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Buka {{ $nama }}" @disabled($nonaktif)>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
            </button>
            <div class="dropdown-default dropdown-menu">
                {{ $slot }}
            </div>
        </div>
    </div>
@endif
