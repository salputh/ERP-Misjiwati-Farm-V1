@props(['aksi' => []])

{{--
    Baris aksi tabel dengan ikon saja, mengikuti katalog template (orderDatatable_actions):
    ikon bundar 35 px, abu-abu sampai di-hover, lalu diberi warna sesuai aksinya.

    Setiap aksi diisi sebagai array dengan kunci:
      kelas  - edit (default), remove, atau view
      ikon   - kelas ikon uil, memakai ikon bawaan kelas bila dikosongkan
      label  - teks untuk title dan aria-label
      click  - aksi Livewire (wire:click.prevent)
      href   - tautan, untuk aksi yang membuka halaman lain
      modal  - id modal yang dibuka
--}}
<ul {{ $attributes->class(['orderDatatable_actions mb-0 d-flex flex-wrap justify-content-end']) }}>
    @foreach ($aksi as $satu)
        <li>
            <a
                href="{{ $satu['href'] ?? '#' }}"
                role="button"
                class="{{ $satu['kelas'] ?? 'edit' }}"
                title="{{ $satu['label'] }}"
                aria-label="{{ $satu['label'] }}"
                @isset($satu['click']) wire:click.prevent="{!! $satu['click'] !!}" @endisset
                @isset($satu['modal']) data-bs-toggle="modal" data-bs-target="{{ $satu['modal'] }}" @endisset
            >
                <i class="uil {{ $satu['ikon'] ?? ['remove' => 'uil-trash-alt', 'view' => 'uil-eye'][$satu['kelas'] ?? 'edit'] ?? 'uil-edit' }}" aria-hidden="true"></i>
            </a>
        </li>
    @endforeach
</ul>
