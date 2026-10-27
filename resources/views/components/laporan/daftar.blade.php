@props(['daftar', 'periode', 'tanggalAktif', 'tanggalDipilih' => []])

{{-- Daftar laporan harian periode ini, terbaru dulu (HexaDash: Basic Table dengan checkbox seperti User Data Table).
     Lihat membuka kartu laporan di modal (x-laporan.modal); tanggalnya menuju halaman laporan tanggal itu.
     Hapus membuka modal konfirmasi (x-konfirmasi #konfirmasi-hapus-laporan). Baris laporan yang sedang ditampilkan disorot. --}}
<div class="col-12 mb-25" id="daftar-laporan">
    <x-kartu judul="Daftar laporan harian" badan="p-0">
        <x-slot:ekstra class="d-flex align-items-center flex-wrap gap-2 tanpa-kapital">
            <span class="fs-13 color-light">{{ count($tanggalDipilih) }} laporan dipilih</span>
            <x-tombol warna="danger" wire:click="mintaHapusTerpilih" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-laporan-terpilih" :disabled="$tanggalDipilih === []">Hapus terpilih</x-tombol>
            <x-tombol data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</x-tombol>
        </x-slot:ekstra>

        <div class="table4 p-25">
            @error('tanggalTerpilih')
                <x-peringatan warna="danger">{{ $message }}</x-peringatan>
            @enderror

            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th>
                                <div class="checkbox-theme-default custom-checkbox check-all">
                                    <input
                                        class="checkbox"
                                        type="checkbox"
                                        id="laporan-pilih-semua"
                                        @checked(count($daftar) > 0 && count($tanggalDipilih) === count($daftar))
                                        wire:click="pilihSemua"
                                    >
                                    <label for="laporan-pilih-semua"><span class="visually-hidden">Pilih semua laporan harian</span></label>
                                </div>
                            </th>
                            <th><span class="userDatatable-title">Tanggal</span></th>
                            <th class="text-end"><span class="userDatatable-title">Usia</span></th>
                            <th class="text-end"><span class="userDatatable-title">Kematian (ekor)</span></th>
                            <th class="text-end d-none d-md-table-cell"><span class="userDatatable-title">Pakan terpakai (zak)</span></th>
                            <th class="text-end d-none d-md-table-cell"><span class="userDatatable-title">Pakan masuk (zak)</span></th>
                            <th class="text-end d-none d-sm-table-cell"><span class="userDatatable-title">ABW (g)</span></th>
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($daftar as $baris)
                            <tr wire:key="laporan-{{ $baris['tanggal']->format('Y-m-d') }}" @class(['order-bg-opacity-primary' => $baris['tanggal']->isSameDay($tanggalAktif)])>
                                <td>
                                    <div class="checkbox-theme-default custom-checkbox">
                                        <input
                                            class="checkbox"
                                            type="checkbox"
                                            id="laporan-pilih-{{ $baris['tanggal']->format('Y-m-d') }}"
                                            value="{{ $baris['tanggal']->format('Y-m-d') }}"
                                            wire:model.live="tanggalTerpilih"
                                        >
                                        <label for="laporan-pilih-{{ $baris['tanggal']->format('Y-m-d') }}"><span class="visually-hidden">Pilih laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}</span></label>
                                    </div>
                                </td>
                                <td>
                                    <div class="userDatatable-content">
                                        <a href="{{ route('laporan.harian', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')]) }}" class="fw-500 color-dark">{{ $baris['tanggal']->translatedFormat('D, j M Y') }}</a>
                                    </div>
                                </td>
                                <td class="text-end"><div class="userDatatable-content">{{ $baris['umur'] }} hari</div></td>
                                <td class="text-end"><div class="userDatatable-content">@angka($baris['kematian'])</div></td>
                                <td class="text-end d-none d-md-table-cell"><div class="userDatatable-content">{{ \App\Support\Format::ringkas($baris['pakan_terpakai']) }}</div></td>
                                <td class="text-end d-none d-md-table-cell"><div class="userDatatable-content">{{ \App\Support\Format::ringkas($baris['pakan_masuk']) }}</div></td>
                                <td class="text-end d-none d-sm-table-cell"><div class="userDatatable-content">{{ \App\Support\Format::ringkas($baris['abw']) }}</div></td>
                                <td>
                                    <x-aksi.ikon :aksi="[
                                        ['kelas' => 'view', 'label' => 'Lihat laporan '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'buka(\''.$baris['tanggal']->format('Y-m-d').'\')', 'modal' => '#modal-laporan-harian'],
                                        ['kelas' => 'edit', 'label' => 'Ubah laporan '.$baris['tanggal']->translatedFormat('j F Y'), 'href' => route('laporan.harian.form', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')])],
                                        ['kelas' => 'remove', 'label' => 'Hapus laporan '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'mintaHapus(\''.$baris['tanggal']->format('Y-m-d').'\')', 'modal' => '#konfirmasi-hapus-laporan'],
                                    ]" />
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <p class="fs-13 color-light mt-15 mb-0">
                Satu baris adalah semua catatan pada tanggal itu: kematian dan ABW tiap kandang, pakan yang diberikan, dan pakan masuk. Tanda hubung berarti belum dicatat. ABW adalah rata-rata kandang yang menimbang pada hari itu.
            </p>
        </div>
    </x-kartu>
</div>
