@props(['perHari', 'dimuat', 'total', 'jenis', 'modul'])

{{-- Riwayat aktivitas per hari, terbaru di atas . Dua dropdown menyaring jenis aksi dan modul. --}}
<div class="col-12 mb-4">
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

        <div class="tabel-data">
            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Aksi</th>
                            <th>Modul</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    @forelse ($perHari as $tanggal => $sehari)
                        <tbody wire:key="hari-{{ $tanggal }}">
                            <x-tabel.grup kolom="4" :judul="$sehari->first()->created_at->translatedFormat('l, j F Y')" />
                            @foreach ($sehari as $aktivitas)
                                <tr wire:key="aktivitas-{{ $aktivitas->id }}">
                                    <td>{{ $aktivitas->created_at->format('H:i') }}</td>
                                    <td><span class="badge m-0 bg-{{ $aktivitas->jenis->warna() }}-subtle text-{{ $aktivitas->jenis->warna() }}">{{ $aktivitas->jenis->label() }}</span></td>
                                    <td><i class="bi {{ $aktivitas->modul->ikon() }} text-body-secondary me-1" aria-hidden="true"></i>{{ $aktivitas->modul->label() }}</td>
                                    <td class="w-50">
                                        <span class="d-block text-body fw-medium">{{ $aktivitas->kalimat() }}</span>
                                        @isset($aktivitas->rincian)
                                            <span class="d-block small text-body-secondary">{{ $aktivitas->rincian }}</span>
                                        @endisset
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    @empty
                        <tbody>
                            <tr>
                                <td colspan="4" class="text-center text-body-secondary">Tidak ada aktivitas yang cocok dengan saringan ini.</td>
                            </tr>
                        </tbody>
                    @endforelse
                </table>
            </div>

            @if ($dimuat < $total)
                <div class="text-center mt-4">
                    <x-tombol warna="light" variasi="outlined" wire:click="muatLagi">Tampilkan lebih banyak</x-tombol>
                    <span class="d-block small text-body-secondary mt-2">Menampilkan @angka($dimuat) dari @angka($total) aktivitas</span>
                </div>
            @endif
            <p class="small text-body-secondary mt-3 mb-0">Satu baris untuk tiap aksi simpan atau hapus, terbaru di atas. Keterangan adalah salinan saat aksi dilakukan, jadi tetap terbaca setelah datanya diubah atau dihapus.</p>
        </div>
    </x-kartu>
</div>
