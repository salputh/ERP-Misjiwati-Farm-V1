@props(['daftar', 'periode', 'tanggalAktif'])

{{-- Daftar laporan harian periode ini, terbaru dulu, dengan aksi lihat, ubah, dan hapus (ikon aksi tabel template).
     Lihat membuka kartu laporan di modal (x-laporan.modal); tanggalnya menuju halaman laporan tanggal itu.
     Hapus membuka modal konfirmasi (x-konfirmasi #konfirmasi-hapus-laporan). Baris laporan yang sedang ditampilkan disorot. --}}
<div class="col-lg-12 mb-25" id="daftar-laporan">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Daftar laporan harian</h6>
            <div class="card-extra">
                <a href="{{ route('laporan.harian.form', ['periode' => $periode->id]) }}" class="btn btn-primary btn-sm btn-squared tanpa-kapital">Tambah laporan</a>
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">Tanggal</th>
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
                                <tr wire:key="laporan-{{ $baris['tanggal']->format('Y-m-d') }}" @class(['baris-sorot' => $baris['tanggal']->isSameDay($tanggalAktif)])>
                                    <td class="text-start">
                                        <a href="{{ route('laporan.harian', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')]) }}" class="fw-500 color-dark">{{ $baris['tanggal']->translatedFormat('D, j M Y') }}</a>
                                    </td>
                                    <td class="text-end">{{ $baris['umur'] }} hari</td>
                                    <td class="text-end">@angka($baris['kematian'])</td>
                                    <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_terpakai']) }}</td>
                                    <td class="text-end d-none d-md-table-cell">{{ \App\Support\Format::ringkas($baris['pakan_masuk']) }}</td>
                                    <td class="text-end d-none d-sm-table-cell">{{ \App\Support\Format::ringkas($baris['abw']) }}</td>
                                    <td class="text-end">
                                        <ul class="orderDatatable_actions mb-0 d-flex flex-wrap ms-auto">
                                            <li>
                                                <a href="#" role="button" class="view" title="Lihat laporan" aria-label="Lihat laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}" wire:click.prevent="buka('{{ $baris['tanggal']->format('Y-m-d') }}')" data-bs-toggle="modal" data-bs-target="#modal-laporan-harian">
                                                    <i class="uil uil-eye"></i>
                                                </a>
                                            </li>
                                            <li>
                                                <a href="{{ route('laporan.harian.form', ['periode' => $periode->id, 'tanggal' => $baris['tanggal']->format('Y-m-d')]) }}" class="edit" title="Ubah laporan" aria-label="Ubah laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}">
                                                    <i class="uil uil-edit"></i>
                                                </a>
                                            </li>
                                            <li>
                                                <a href="#" role="button" class="remove" title="Hapus laporan" aria-label="Hapus laporan {{ $baris['tanggal']->translatedFormat('j F Y') }}" wire:click.prevent="mintaHapus('{{ $baris['tanggal']->format('Y-m-d') }}')" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-laporan">
                                                    <i class="uil uil-trash-alt"></i>
                                                </a>
                                            </li>
                                        </ul>
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
