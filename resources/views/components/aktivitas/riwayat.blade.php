@props(['perHari', 'dimuat', 'total', 'jenis', 'modul'])

{{-- Riwayat aktivitas per hari, terbaru di atas. Dua dropdown menyaring jenis aksi dan modul. --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6 class="tanpa-kapital">@angka($total) aktivitas</h6>
            <div class="card-extra tanpa-kapital riwayat-aktivitas__saringan">
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
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen tabel-kas tabel-aktivitas mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th class="text-start"><span class="userDatatable-title">Waktu</span></th>
                                <th class="text-start"><span class="userDatatable-title">Aksi</span></th>
                                <th class="text-start"><span class="userDatatable-title">Modul</span></th>
                                <th class="text-start"><span class="userDatatable-title">Keterangan</span></th>
                            </tr>
                        </thead>
                        @forelse ($perHari as $tanggal => $sehari)
                            <tbody wire:key="hari-{{ $tanggal }}">
                                <tr class="panen-hari">
                                    <th colspan="4" scope="colgroup" class="text-start">{{ $sehari->first()->created_at->translatedFormat('l, j F Y') }}</th>
                                </tr>
                                @foreach ($sehari as $aktivitas)
                                    <tr wire:key="aktivitas-{{ $aktivitas->id }}">
                                        <td class="text-start">{{ $aktivitas->created_at->format('H:i') }}</td>
                                        <td class="text-start"><span class="dm-tag tag-transparented m-0 tag-{{ $aktivitas->jenis->warna() }}">{{ $aktivitas->jenis->label() }}</span></td>
                                        <td class="text-start text-nowrap"><i class="uil {{ $aktivitas->modul->ikon() }} color-gray me-1" aria-hidden="true"></i>{{ $aktivitas->modul->label() }}</td>
                                        <td class="text-start tabel-kas__uraian">
                                            <span class="color-dark fw-500">{{ $aktivitas->kalimat() }}</span>
                                            @isset($aktivitas->rincian)
                                                <span class="d-block fs-12 color-gray">{{ $aktivitas->rincian }}</span>
                                            @endisset
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        @empty
                            <tbody>
                                <tr>
                                    <td colspan="4" class="text-start color-gray">Tidak ada aktivitas yang cocok dengan saringan ini.</td>
                                </tr>
                            </tbody>
                        @endforelse
                    </table>
                </div>
            </div>
            @if ($dimuat < $total)
                <div class="text-center mt-20">
                    <button type="button" class="btn btn-outline-lighten btn-sm d-inline-flex" wire:click="muatLagi">Tampilkan lebih banyak</button>
                    <span class="d-block fs-12 color-gray mt-10">Menampilkan @angka($dimuat) dari @angka($total) aktivitas</span>
                </div>
            @endif
            <p class="fs-12 color-gray mt-15 mb-0">Satu baris untuk tiap aksi simpan atau hapus, terbaru di atas. Keterangan adalah salinan saat aksi dilakukan, jadi tetap terbaca setelah datanya diubah atau dihapus.</p>
        </div>
    </div>
</div>
