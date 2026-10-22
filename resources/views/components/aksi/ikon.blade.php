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
<ul class="orderDatatable_actions mb-0 d-flex flex-wrap ms-auto">
    @foreach ($aksi as $satu)
        @php
            $kelas = $satu['kelas'] ?? 'edit';
            $ikon = $satu['ikon'] ?? match ($kelas) {
                'remove' => 'uil-trash-alt',
                'view' => 'uil-eye',
                default => 'uil-edit',
            };
        @endphp
        <li>
            <a
                href="{{ $satu['href'] ?? '#' }}"
                role="button"
                class="{{ $kelas }}"
                title="{{ $satu['label'] }}"
                aria-label="{{ $satu['label'] }}"
                @isset($satu['click']) wire:click.prevent="{!! $satu['click'] !!}" @endif
                @isset($satu['modal']) data-bs-toggle="modal" data-bs-target="{{ $satu['modal'] }}" @endif
            >
                <i class="uil {{ $ikon }}" aria-hidden="true"></i>
            </a>
        </li>
    @endforeach
</ul>
