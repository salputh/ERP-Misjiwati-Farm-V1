@props(['perHari', 'dimuat', 'total', 'jenis', 'modul'])

{{-- Riwayat aktivitas per hari, terbaru di atas (HexaDash: Basic Table, Basic Usage). Dua dropdown menyaring jenis aksi dan modul. --}}
<div class="col-12 mb-25">
    <x-kartu badan="p-0">
        <x-slot:judul>@angka($total) aktivitas</x-slot:judul>
        <x-slot:ekstra class="d-flex flex-wrap gap-2 tanpa-kapital">
            <x-pilih class="pilih--kanan" :label="$jenis?->label() ?? 'Semua aksi'" nama="Saring aksi">
                <button type="button" wire:click="pilihJenis('')" wire:key="aksi-semua" @class(['dropdown-item', 'active' => ! $jenis])>Semua aksi</button>
                @foreach (\App\Enums\JenisAktivitas::cases() as $pilihan)
                    <button type="button" wire:click="pilihJenis('{{ $pilihan->value }}')" wire:key="aksi-{{ $pilihan->value }}" @class(['dropdown-item', 'active' => $pilihan === $jenis])>{{ $pilihan->label() }}</button>
                @endforeach
            </x-pilih>
            <x-pilih class="pilih--kanan" :label="$modul?->label() ?? 'Semua modul'" nama="Saring modul">
                <button type="button" wire:click="pilihModul('')" wire:key="modul-semua" @class(['dropdown-item', 'active' => ! $modul])>Semua modul</button>
                @foreach (\App\Enums\ModulAktivitas::cases() as $pilihan)
                    <button type="button" wire:click="pilihModul('{{ $pilihan->value }}')" wire:key="modul-{{ $pilihan->value }}" @class(['dropdown-item', 'active' => $pilihan === $modul])>{{ $pilihan->label() }}</button>
                @endforeach
            </x-pilih>
        </x-slot:ekstra>

        <div class="table4 p-25">
            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Waktu</span></th>
                            <th><span class="userDatatable-title">Aksi</span></th>
                            <th><span class="userDatatable-title">Modul</span></th>
                            <th><span class="userDatatable-title">Keterangan</span></th>
                        </tr>
                    </thead>
                    @forelse ($perHari as $tanggal => $sehari)
                        <tbody wire:key="hari-{{ $tanggal }}">
                            <x-tabel.grup kolom="4" :judul="$sehari->first()->created_at->translatedFormat('l, j F Y')" />
                            @foreach ($sehari as $aktivitas)
                                <tr wire:key="aktivitas-{{ $aktivitas->id }}">
                                    <td><div class="userDatatable-content">{{ $aktivitas->created_at->format('H:i') }}</div></td>
                                    <td><span class="dm-tag tag-transparented m-0 tag-{{ $aktivitas->jenis->warna() }}">{{ $aktivitas->jenis->label() }}</span></td>
                                    <td><div class="userDatatable-content"><i class="uil {{ $aktivitas->modul->ikon() }} color-light me-1" aria-hidden="true"></i>{{ $aktivitas->modul->label() }}</div></td>
                                    <td class="w-50">
                                        <span class="d-block color-dark fw-500">{{ $aktivitas->kalimat() }}</span>
                                        @isset($aktivitas->rincian)
                                            <span class="d-block fs-13 color-light">{{ $aktivitas->rincian }}</span>
                                        @endisset
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    @empty
                        <tbody>
                            <tr>
                                <td colspan="4" class="text-center color-light">Tidak ada aktivitas yang cocok dengan saringan ini.</td>
                            </tr>
                        </tbody>
                    @endforelse
                </table>
            </div>

            @if ($dimuat < $total)
                <div class="text-center mt-25">
                    <x-tombol warna="light" variasi="outlined" wire:click="muatLagi">Tampilkan lebih banyak</x-tombol>
                    <span class="d-block fs-13 color-light mt-10">Menampilkan @angka($dimuat) dari @angka($total) aktivitas</span>
                </div>
            @endif
            <p class="fs-13 color-light mt-15 mb-0">Satu baris untuk tiap aksi simpan atau hapus, terbaru di atas. Keterangan adalah salinan saat aksi dilakukan, jadi tetap terbaca setelah datanya diubah atau dihapus.</p>
        </div>
    </x-kartu>
</div>
