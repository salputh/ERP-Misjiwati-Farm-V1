@props(['daftar', 'periode', 'tanggalAktif', 'tanggalDipilih' => []])

{{-- Daftar laporan harian periode ini, terbaru dulu .
     Lihat membuka kartu laporan di modal (x-laporan.modal); tanggalnya menuju halaman laporan tanggal itu.
     Hapus membuka modal konfirmasi (x-konfirmasi #konfirmasi-hapus-laporan). Baris laporan yang sedang ditampilkan disorot. --}}
<div class="col-12 mb-4" id="daftar-laporan">
    <x-kartu judul="Daftar laporan harian" badan="p-0">
        <x-slot:ekstra class="d-flex align-items-center flex-wrap gap-2 tanpa-kapital">
            <span class="small text-body-secondary">{{ count($tanggalDipilih) }} laporan dipilih</span>
            <x-tombol warna="danger" wire:click="mintaHapusTerpilih" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-laporan-terpilih" :disabled="$tanggalDipilih === []">Hapus terpilih</x-tombol>
            <x-tombol data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</x-tombol>
        </x-slot:ekstra>

        <div class="tabel-data">
            @error('tanggalTerpilih')
                <x-peringatan warna="danger">{{ $message }}</x-peringatan>
            @enderror

            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>
                                <div class="form-check">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        id="laporan-pilih-semua"
                                        @checked(count($daftar) > 0 && count($tanggalDipilih) === count($daftar))
                                        wire:click="pilihSemua"
                                    >
                                    <label for="laporan-pilih-semua"><span class="visually-hidden">Pilih semua laporan harian</span></label>
                                </div>
                            </th>
                            <th>Tanggal</th>
                            <th class="text-end">Usia</th>
                            <th class="text-end">Kematian (ekor)</th>
                            <th class="text-end d-none d-md-table-cell">Pakan terpakai (zak)</th>
                            <th class="text-end d-none d-md-table-cell">Pakan masuk (zak)</th>
                            <th class="text-end d-none d-sm-table-cell">ABW (g)</th>
                            <th class="text-end">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($daftar as $baris)
                            <tr wire:key="laporan-{{ $baris['tanggal']->format('Y-m-d') }}" @class(['bg-primary-subtle' => $baris['tanggal']->isSameDay($tanggalAktif)])>
                                <td>
                                    <div class="form-check">
                                        <input
                                            class="form-check-input"
                                            type="checkbox"
                                            id="laporan-pilih-{{ $baris['tanggal']->format('Y-m-d') }}"
                                            value="{{ $baris['tanggal']->format('Y-m-d') }}"
                                            wire:model.live="tanggalTerpilih"
                                        >
                                        <label for="laporan-pilih-{{ $baris['tanggal']->format('Y-m-d') }}"><span class="visually-hidden">Pilih laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}</span></label>
                                    </div>
                                </td>
                                <td>
                                    <a href="{{ route('laporan.harian', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')]) }}" class="db-who-name">{{ $baris['tanggal']->translatedFormat('D, j M Y') }}</a>
                                </td>
                                <td class="text-end">{{ $baris['umur'] }} hari</td>
                                <td class="text-end">@angka($baris['kematian'])</td>
                                <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_terpakai']) }}</td>
                                <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_masuk']) }}</td>
                                <td class="text-end d-none d-sm-table-cell">{{ \App\Support\Format::ringkas($baris['abw']) }}</td>
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

            <p class="small text-body-secondary mt-3 mb-0">
                Satu baris adalah semua catatan pada tanggal itu: kematian dan ABW tiap kandang, pakan yang diberikan, dan pakan masuk. Tanda hubung berarti belum dicatat. ABW adalah rata-rata kandang yang menimbang pada hari itu.
            </p>
        </div>
    </x-kartu>
</div>
