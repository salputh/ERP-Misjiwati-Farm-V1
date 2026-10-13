@props(['hari', 'total', 'periodeId'])

{{-- Nota timbang per hari panen dengan subtotal tiap hari dan total seluruh panen. Tab menyaring satu hari (Alpine saringHari). --}}
<div class="col-lg-12 mb-25" x-data="saringHari">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <div class="card-title d-flex align-items-center gap-3">
                <img src="{{ asset('assets/img/svg/clipboard.svg') }}" alt="" class="svg me-1">
                <h6 class="me-1">Nota timbang</h6>
                <button type="button" class="btn btn-primary btn-xs btn-squared radius-md shadow2 btn-sm" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-nota-panen" wire:loading.attr="disabled" wire:target="tambah, simpan">
                    Tambah data panen
                </button>
            </div>
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
                <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                    <button type="button" class="btn btn-xs btn-squared btn-outline-primary" @click="salinGambar($refs.tabel)" :disabled="menyalin" aria-live="polite">
                        <span x-text="statusSalin || (hari === 0 ? 'Salin gambar semua' : 'Salin gambar hari ' + hari)">Salin gambar semua</span>
                    </button>
                    <div class="dropdown">
                        <button type="button" class="btn btn-xs btn-squared btn-outline-primary" data-bs-toggle="dropdown" aria-expanded="false">
                            Export PDF
                            <i class="uil uil-angle-down"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId]) }}">Semua hari panen</a></li>
                            @foreach ($hari as $sesi)
                                <li><a class="dropdown-item" href="{{ route('panen.export', ['periode' => $periodeId, 'hari' => $sesi['nomor']]) }}">Hari {{ $sesi['nomor'] }}</a></li>
                            @endforeach
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table x-ref="tabel" class="table table--default table-borderless tabel-laporan tabel-panen mb-0">
                        <thead>
                            <tr>
                                <th class="text-start">No.</th>
                                <th class="text-start">No. BTPA / SPA</th>
                                <th class="text-start">Pembeli / no. polisi</th>
                                <th class="text-start">Mulai</th>
                                <th class="text-start">Selesai</th>
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
                                <tr class="panen-hari">
                                    <th colspan="13" scope="colgroup" class="text-start">
                                        Hari {{ $sesi['nomor'] }}
                                        <span>{{ $sesi['dari']->translatedFormat('j F') }} s/d {{ $sesi['sampai']->translatedFormat('j F Y') }}</span>
                                    </th>
                                </tr>
                                @foreach ($sesi['nota'] as $nota)
                                    <tr wire:key="nota-panen-{{ $nota['id'] }}">
                                        <td class="text-start">{{ $loop->iteration }}</td>
                                        <td class="text-start">
                                            <strong>{{ $nota['no_btpa'] }}</strong>
                                            <span class="d-block fs-12 color-gray">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                                        </td>
                                        <td class="text-start">
                                            {{ $nota['pembeli'] }}
                                            <span class="d-block fs-12 color-gray">{{ $nota['no_polisi'] }}</span>
                                            @if ($nota['tukang_tangkap'])
                                                <span class="d-block fs-12 color-gray">Tukang Tangkap: {{ $nota['tukang_tangkap'] }}</span>
                                            @endif
                                        </td>
                                        <td class="text-start">{{ $nota['mulai']->translatedFormat('j M H:i') }}</td>
                                        <td class="text-start">{{ $nota['selesai']->translatedFormat('j M H:i') }}</td>
                                        <x-panen.angka :jumlah="$nota" />
                                        <td class="text-end">
                                            <div class="dm-button-list d-inline-flex align-items-center gap-2">
                                                <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubah({{ $nota['id'] }})" data-bs-toggle="modal" data-bs-target="#modal-form-nota-panen" wire:loading.attr="disabled" wire:target="ubah, simpan, hapus">
                                                    <img src="{{ asset('assets/img/svg/edit-2.svg') }}" alt="" class="svg me-1">
                                                    Ubah
                                                </button>
                                                <button type="button" class="btn btn-xs btn-squared btn-outline-danger" wire:click="mintaHapus({{ $nota['id'] }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-nota-panen" wire:loading.attr="disabled" wire:target="mintaHapus, hapus">
                                                    <img src="{{ asset('assets/img/svg/trash-2.svg') }}" alt="" class="svg me-1">
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                @endforeach
                                <tr class="panen-subtotal">
                                    <td colspan="5" class="text-start">Subtotal hari {{ $sesi['nomor'] }}</td>
                                    <x-panen.angka :jumlah="$sesi['subtotal']" />
                                    <td></td>
                                </tr>
                            </tbody>
                        @endforeach
                    
                        <tfoot>
                            <tr class="panen-total">
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
