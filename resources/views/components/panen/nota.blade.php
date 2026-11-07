@props(['hari', 'total', 'periodeId', 'bisaDiubah' => true])

{{-- Nota timbang per hari panen dengan subtotal tiap hari dan total seluruh panen. Tab menyaring satu hari (Alpine saringHari). --}}
<div class="col-12 mb-4" x-data="saringHari">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Nota timbang</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <ul class="nav nav-pills nav-sm" role="tablist">
                    <li>
                        <a href="#" role="tab" class="nav-link" :class="hari === 0 && 'active'" :aria-selected="hari === 0" @click.prevent="hari = 0">Semua</a>
                    </li>
                    @foreach ($hari as $sesi)
                        <li>
                            <a href="#" role="tab" class="nav-link" :class="hari === {{ $sesi['nomor'] }} && 'active'" :aria-selected="hari === {{ $sesi['nomor'] }}" @click.prevent="hari = {{ $sesi['nomor'] }}">Hari {{ $sesi['nomor'] }}</a>
                        </li>
                    @endforeach
                </ul>
            </div>
</header>
            <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-3">
                <x-tombol warna="light" variasi="outlined" ikon="bi-copy" x-on:click="salinGambar($refs.tabel)" x-bind:disabled="menyalin" aria-live="polite">
                    <b class="fw-medium" x-text="statusSalin || (hari === 0 ? 'Salin gambar semua' : 'Salin gambar hari ' + hari)">Salin gambar semua</b>
                </x-tombol>
                <div class="dropdown">
                    <x-tombol warna="light" variasi="outlined" ikon="bi-file-earmark-arrow-down" data-bs-toggle="dropdown" aria-expanded="false">Export PDF<i class="bi bi-chevron-down ms-2 me-0" aria-hidden="true"></i></x-tombol>
                    <div class="dropdown-menu dropdown-menu-end">
                        <a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId]) }}">Semua hari panen</a>
                        @foreach ($hari as $sesi)
                            <a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId, 'hari' => $sesi['nomor']]) }}">Hari {{ $sesi['nomor'] }}</a>
                        @endforeach
                    </div>
                </div>
                @if ($bisaDiubah)
                    <x-tombol ikon="bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-nota-panen" wire:loading.attr="disabled" wire:target="tambah, simpan">Tambah data panen</x-tombol>
                @endif
            </div>
            <div class="tabel-data">
                <div class="table-responsive">
                    <table x-ref="tabel" class="table tabel-rapat mb-0 db-table">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>No. BTPA / SPA</th>
                                <th>Pembeli / no. polisi</th>
                                <th>Mulai</th>
                                <th>Selesai</th>
                                <th class="text-end">Krat</th>
                                <th class="text-end">Ekor</th>
                                <th class="text-end">Berat (kg)</th>
                                <th class="text-end">BW (kg)</th>
                                <th class="text-end">Kg / krat</th>
                                <th class="text-end">Netto (kg)</th>
                                <th class="text-end">Selisih</th>
                                <th class="text-end">Aksi</th>
                            </tr>
                        </thead>
                        @foreach ($hari as $sesi)
                            <tbody wire:key="hari-panen-{{ $sesi['nomor'] }}" x-show="tampil({{ $sesi['nomor'] }})">
                                <x-tabel.grup kolom="13" :judul="'Hari '.$sesi['nomor']" :keterangan="$sesi['dari']->translatedFormat('j F').' s/d '.$sesi['sampai']->translatedFormat('j F Y')" />
                                @foreach ($sesi['nota'] as $nota)
                                    <tr wire:key="nota-panen-{{ $nota['id'] }}">
                                        <td>{{ $loop->iteration }}</td>
                                        <td>
                                            <span class="d-block fw-medium text-body">{{ $nota['no_btpa'] }}</span>
                                            <span class="d-block small text-body-secondary">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                                        </td>
                                        <td class="sel-lebar">
                                            {{ $nota['pembeli'] }}
                                            <span class="d-block small text-body-secondary">{{ $nota['no_polisi'] }}</span>
                                            @if ($nota['pemanen_krat'] !== [])
                                                @foreach ($nota['pemanen_krat'] as $pemanen)
                                                    <span class="d-block small text-body-secondary">
                                                        Tukang Tangkap: {{ $pemanen['nama'] }} (mulai krat {{ $pemanen['krat_mulai'] }})
                                                        @if ($pemanen['berat_timbang_kg'] !== null)
                                                            — @angka($pemanen['berat_timbang_kg'], 2) kg
                                                        @endif
                                                    </span>
                                                @endforeach
                                            @elseif ($nota['tukang_tangkap'])
                                                <span class="d-block small text-body-secondary">Tukang Tangkap: {{ $nota['tukang_tangkap'] }}</span>
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
                                <tr class="fw-medium text-body">
                                    <td colspan="5" class="text-start">Subtotal hari {{ $sesi['nomor'] }}</td>
                                    <x-panen.angka :jumlah="$sesi['subtotal']" />
                                    <td></td>
                                </tr>
                            </tbody>
                        @endforeach
                    
                        <tfoot>
                            <tr class="bg-primary-subtle">
                                <th colspan="5" class="text-start">Total seluruh panen</th>
                                <x-panen.angka :jumlah="$total" sel="th" />
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        
</div>
</section>
</div>
