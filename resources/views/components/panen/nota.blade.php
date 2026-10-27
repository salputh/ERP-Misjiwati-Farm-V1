@props(['hari', 'total', 'periodeId', 'bisaDiubah' => true])

{{-- Nota timbang per hari panen dengan subtotal tiap hari dan total seluruh panen. Tab menyaring satu hari (Alpine saringHari). --}}
<div class="col-12 mb-25" x-data="saringHari">
    <div class="card card-default card-md">
        <div class="card-header">
            <h6>Nota timbang</h6>
            <div class="card-extra">
                <ul class="card-tab-links nav-tabs nav" role="tablist">
                    <li>
                        <a href="#" role="tab" :class="hari === 0 && 'active'" :aria-selected="hari === 0" @click.prevent="hari = 0">Semua</a>
                    </li>
                    @foreach ($hari as $sesi)
                        <li>
                            <a href="#" role="tab" :class="hari === {{ $sesi['nomor'] }} && 'active'" :aria-selected="hari === {{ $sesi['nomor'] }}" @click.prevent="hari = {{ $sesi['nomor'] }}">Hari {{ $sesi['nomor'] }}</a>
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>
        <div class="card-body">
            <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-20">
                <x-tombol warna="light" variasi="outlined" ikon="uil-copy" x-on:click="salinGambar($refs.tabel)" x-bind:disabled="menyalin" aria-live="polite">
                    <b class="fw-500" x-text="statusSalin || (hari === 0 ? 'Salin gambar semua' : 'Salin gambar hari ' + hari)">Salin gambar semua</b>
                </x-tombol>
                <div class="dropdown dropdown-click">
                    <x-tombol warna="light" variasi="outlined" ikon="uil-file-download" data-bs-toggle="dropdown" aria-expanded="false">Export PDF<i class="las la-angle-down ms-2 me-0" aria-hidden="true"></i></x-tombol>
                    <div class="dropdown-default dropdown-menu dropdown-menu-end">
                        <a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId]) }}">Semua hari panen</a>
                        @foreach ($hari as $sesi)
                            <a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId, 'hari' => $sesi['nomor']]) }}">Hari {{ $sesi['nomor'] }}</a>
                        @endforeach
                    </div>
                </div>
                @if ($bisaDiubah)
                    <x-tombol ikon="uil-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-nota-panen" wire:loading.attr="disabled" wire:target="tambah, simpan">Tambah data panen</x-tombol>
                @endif
            </div>
            <div class="table4">
                <div class="table-responsive">
                    <table x-ref="tabel" class="table tabel-rapat mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">No.</span></th>
                                <th><span class="userDatatable-title">No. BTPA / SPA</span></th>
                                <th><span class="userDatatable-title">Pembeli / no. polisi</span></th>
                                <th><span class="userDatatable-title">Mulai</span></th>
                                <th><span class="userDatatable-title">Selesai</span></th>
                                <th class="text-end"><span class="userDatatable-title">Krat</span></th>
                                <th class="text-end"><span class="userDatatable-title">Ekor</span></th>
                                <th class="text-end"><span class="userDatatable-title">Berat (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">BW (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Kg / krat</span></th>
                                <th class="text-end"><span class="userDatatable-title">Netto (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Selisih</span></th>
                                <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                            </tr>
                        </thead>
                        @foreach ($hari as $sesi)
                            <tbody wire:key="hari-panen-{{ $sesi['nomor'] }}" x-show="tampil({{ $sesi['nomor'] }})">
                                <x-tabel.grup kolom="13" :judul="'Hari '.$sesi['nomor']" :keterangan="$sesi['dari']->translatedFormat('j F').' s/d '.$sesi['sampai']->translatedFormat('j F Y')" />
                                @foreach ($sesi['nota'] as $nota)
                                    <tr wire:key="nota-panen-{{ $nota['id'] }}">
                                        <td>{{ $loop->iteration }}</td>
                                        <td>
                                            <span class="d-block fw-500 color-dark">{{ $nota['no_btpa'] }}</span>
                                            <span class="d-block fs-12 color-light">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                                        </td>
                                        <td class="sel-lebar">
                                            {{ $nota['pembeli'] }}
                                            <span class="d-block fs-12 color-light">{{ $nota['no_polisi'] }}</span>
                                            @if ($nota['pemanen_krat'] !== [])
                                                @foreach ($nota['pemanen_krat'] as $pemanen)
                                                    <span class="d-block fs-12 color-light">
                                                        Tukang Tangkap: {{ $pemanen['nama'] }} (mulai krat {{ $pemanen['krat_mulai'] }})
                                                        @if ($pemanen['berat_timbang_kg'] !== null)
                                                            — @angka($pemanen['berat_timbang_kg'], 2) kg
                                                        @endif
                                                    </span>
                                                @endforeach
                                            @elseif ($nota['tukang_tangkap'])
                                                <span class="d-block fs-12 color-light">Tukang Tangkap: {{ $nota['tukang_tangkap'] }}</span>
                                            @endif
                                        </td>
                                        <td>{{ $nota['mulai']->translatedFormat('j M H:i') }}</td>
                                        <td>{{ $nota['selesai']->translatedFormat('j M H:i') }}</td>
                                        <x-panen.angka :jumlah="$nota" />
                                        <td>
                                            @if ($bisaDiubah)
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'view', 'label' => 'Lihat nota panen '.$nota['no_btpa'], 'click' => 'lihat('.$nota['id'].')', 'modal' => '#modal-detail-nota-panen'],
                                                    ['kelas' => 'edit', 'label' => 'Ubah nota panen '.$nota['no_btpa'], 'click' => 'ubah('.$nota['id'].')', 'modal' => '#modal-form-nota-panen'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus nota panen '.$nota['no_btpa'], 'click' => 'mintaHapus('.$nota['id'].')', 'modal' => '#konfirmasi-hapus-nota-panen'],
                                                ]" />
                                            @else
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'view', 'label' => 'Lihat nota panen '.$nota['no_btpa'], 'click' => 'lihat('.$nota['id'].')', 'modal' => '#modal-detail-nota-panen'],
                                                ]" />
                                            @endif
                                        </td>
                                    </tr>
                                @endforeach
                                <tr class="fw-500 color-dark">
                                    <td colspan="5" class="text-start">Subtotal hari {{ $sesi['nomor'] }}</td>
                                    <x-panen.angka :jumlah="$sesi['subtotal']" />
                                    <td></td>
                                </tr>
                            </tbody>
                        @endforeach
                    
                        <tfoot>
                            <tr class="order-bg-opacity-primary">
                                <th colspan="5" class="text-start">Total seluruh panen</th>
                                <x-panen.angka :jumlah="$total" sel="th" />
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
