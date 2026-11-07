@props(['aksi' => []])

{{--
    Baris aksi tabel dengan ikon saja (btn btn-icon Basalt). Tombol ikon dengan aria-label otomatis
    menampilkan labelnya sebagai tooltip saat disorot atau difokus.

    Setiap aksi diisi sebagai array dengan kunci:
      kelas  - edit (default), remove, atau view
      ikon   - kelas ikon bi, memakai ikon bawaan kelas bila dikosongkan
      label  - teks untuk title dan aria-label
      click  - aksi Livewire (wire:click.prevent)
      href   - tautan, untuk aksi yang membuka halaman lain
      modal  - id modal yang dibuka
--}}
<div {{ $attributes->class(['d-flex flex-wrap justify-content-end gap-1']) }}>
    @foreach ($aksi as $satu)
        <a
            href="{{ $satu['href'] ?? '#' }}"
            role="button"
            @class(['btn btn-icon btn-sm', 'text-danger' => ($satu['kelas'] ?? 'edit') === 'remove'])
            aria-label="{{ $satu['label'] }}"
            @isset($satu['click']) wire:click.prevent="{!! $satu['click'] !!}" @endisset
            @isset($satu['modal']) data-bs-toggle="modal" data-bs-target="{{ $satu['modal'] }}" @endisset
        >
            <i class="bi {{ $satu['ikon'] ?? ['remove' => 'bi-trash', 'view' => 'bi-eye'][$satu['kelas'] ?? 'edit'] ?? 'bi-pencil-square' }}" aria-hidden="true"></i>
        </a>
    @endforeach
</div>
