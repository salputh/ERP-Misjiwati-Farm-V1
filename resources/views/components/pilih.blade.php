@props(['label', 'nama', 'ukuran' => 'sm'])

{{-- Pilihan tunggal bergaya template (HexaDash: button with dropdown menu), pengganti <select> bawaan peramban.
     Tombol menampilkan pilihan yang sedang aktif; slot berisi butir .dropdown-item (tautan atau tombol). --}}
<div {{ $attributes->class(['pilih dropdown dropdown-click']) }}>
    <div class="btn-group" role="group" aria-label="{{ $nama }}">
        <button type="button" class="btn btn-outline-lighten btn-{{ $ukuran }}" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">{{ $label }}</button>
        <button type="button" class="btn btn-outline-lighten btn-{{ $ukuran }} dropdown-toggle-split" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Buka {{ $nama }}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </button>
        <div class="dropdown-default dropdown-menu">
            {{ $slot }}
        </div>
    </div>
</div>
