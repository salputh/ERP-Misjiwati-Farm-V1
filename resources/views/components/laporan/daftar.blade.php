@props(['daftar', 'periode', 'tanggalAktif', 'tanggalDipilih' => []])

{{-- Daftar laporan harian periode ini, terbaru dulu, dengan aksi lihat, ubah, dan hapus (ikon aksi tabel template).
     Lihat membuka kartu laporan di modal (x-laporan.modal); tanggalnya menuju halaman laporan tanggal itu.
     Hapus membuka modal konfirmasi (x-konfirmasi #konfirmasi-hapus-laporan). Baris laporan yang sedang ditampilkan disorot. --}}
<div class="col-lg-12 mb-25" id="daftar-laporan">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Daftar laporan harian</h6>
            <div class="card-extra d-flex align-items-center gap-2 flex-wrap">
                <span class="fs-12 color-gray">{{ count($tanggalDipilih) }} laporan dipilih</span>
                <button
                    type="button"
                    class="btn btn-danger btn-sm btn-squared tanpa-kapital"
                    wire:click="mintaHapusTerpilih"
                    data-bs-toggle="modal"
                    data-bs-target="#konfirmasi-hapus-laporan-terpilih"
                    @disabled($tanggalDipilih === [])
                >Hapus terpilih</button>
                <button type="button" class="btn btn-primary btn-sm btn-squared tanpa-kapital" data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">Tambah laporan</button>
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            @error('tanggalTerpilih')
                <div class="alert alert-danger mx-25 mt-25 mb-0" role="alert">
                    <div class="alert-content"><p>{{ $message }}</p></div>
                </div>
            @enderror
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th class="text-center">
                                    <input
                                        type="checkbox"
                                        aria-label="Pilih semua laporan harian"
                                        @checked(count($daftar) > 0 && count($tanggalDipilih) === count($daftar))
                                        wire:click="pilihSemua"
                                    >
                                </th>
                                <th class="text-start"><span class="userDatatable-title">Tanggal</span></th>
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
                                <tr wire:key="laporan-{{ $baris['tanggal']->format('Y-m-d') }}" @class(['baris-sorot' => $baris['tanggal']->isSameDay($tanggalAktif)])>
                                    <td class="text-center">
                                        <input
                                            type="checkbox"
                                            value="{{ $baris['tanggal']->format('Y-m-d') }}"
                                            aria-label="Pilih laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}"
                                            wire:model.live="tanggalTerpilih"
                                        >
                                    </td>
                                    <td class="text-start">
                                        <a href="{{ route('laporan.harian', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')]) }}" class="fw-500 color-dark">{{ $baris['tanggal']->translatedFormat('D, j M Y') }}</a>
                                    </td>
                                    <td class="text-end">{{ $baris['umur'] }} hari</td>
                                    <td class="text-end">@angka($baris['kematian'])</td>
                                    <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_terpakai']) }}</td>
                                    <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_masuk']) }}</td>
                                    <td class="text-end d-none d-sm-table-cell">{{ \App\Support\Format::ringkas($baris['abw']) }}</td>
                                    <td class="text-end">
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
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Satu baris adalah semua catatan pada tanggal itu: kematian dan ABW tiap kandang, pakan yang diberikan, dan pakan masuk. Tanda hubung berarti belum dicatat. ABW adalah rata-rata kandang yang menimbang pada hari itu.
            </p>
        </div>
    </div>
</div>
