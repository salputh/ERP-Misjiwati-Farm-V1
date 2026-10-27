@props(['daftar'])

{{-- Kandang induk farm (HexaDash: List) dengan aksi ubah dan hapus. --}}
<x-kartu judul="Kandang farm" :subjudul="$daftar->count().' kandang · '.\App\Support\Format::angka($daftar->sum('kapasitas')).' ekor kapasitas'" class="mb-25">
    <x-slot:ekstra>
        <x-tombol ukuran="xs" wire:click="tambahKandangMaster" data-bs-toggle="modal" data-bs-target="#modal-kandang-master" wire:loading.attr="disabled" wire:target="tambahKandangMaster, simpanKandangMaster">Tambah</x-tombol>
    </x-slot:ekstra>

    @if ($daftar->isNotEmpty())
        <div class="list-box">
            <ul>
                @foreach ($daftar as $kandang)
                    <li class="list-box__item d-flex align-items-center justify-content-between gap-2" wire:key="kandang-master-{{ $kandang->id }}">
                        <div>
                            <span class="d-block fw-500 color-dark">{{ $kandang->nama }}</span>
                            <span class="d-block fs-13 color-light">
                                Kapasitas @angka($kandang->kapasitas) ekor
                                @if ($kandang->periode_kandang_count > 0)
                                    · dipakai di {{ $kandang->periode_kandang_count }} periode
                                @endif
                            </span>
                        </div>
                        <x-aksi.ikon :aksi="[
                            ['kelas' => 'edit', 'label' => 'Ubah kandang '.$kandang->nama, 'click' => 'ubahKandangMaster('.$kandang->id.')', 'modal' => '#modal-kandang-master'],
                            ['kelas' => 'remove', 'label' => 'Hapus kandang '.$kandang->nama, 'click' => 'mintaHapusKandangMaster('.$kandang->id.')', 'modal' => '#konfirmasi-hapus-kandang-master'],
                        ]" />
                    </li>
                @endforeach
            </ul>
        </div>
    @else
        <p class="color-light text-center mb-0">Belum ada kandang di farm ini.</p>
    @endif
</x-kartu>
