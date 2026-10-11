@props(['target', 'teks' => 'Memuat data', 'cepat' => false])

{{-- Lapisan memuat selayar dengan spinner template, tampil selama aksi Livewire pada target berjalan.
     Target adalah nama aksi atau properti, dipisah koma. Untuk aksi yang menulis ke database lapisan bertahan
     sebentar setelah selesai supaya tetap terlihat; "cepat" dipakai untuk aksi yang hanya memuat data. --}}
<div
    @class(['lapisan-memuat', 'lapisan-memuat--cepat' => $cepat])
    wire:loading.class="lapisan-memuat--tampil"
    wire:target="{{ $target }}"
    role="status"
>
    <div class="lapisan-memuat__isi">
        <x-pemintal ukuran="md" />
        <span>{{ $teks }}</span>
    </div>
</div>
