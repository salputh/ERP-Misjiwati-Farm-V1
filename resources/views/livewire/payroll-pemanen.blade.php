<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Payroll pemanen" :jejak="['Keuangan', 'Payroll pemanen']" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->periode && $this->lembar)
            {{-- Angka utama --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['total_upah'])" label="Total upah pemanen" ikon="bi-cash-stack" warna="primary">
                <small>
                    @if ($this->tampilan['jumlah_dibayar'] > 0)
                        Rp @angka($this->tampilan['sudah_dibayar']) sudah dibayar, Rp @angka($this->tampilan['belum_dibayar']) belum
                    @else
                        Rp @angka($this->lembar['total_upah']), belum ada yang dibayar
                    @endif
                </small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->lembar['berat_teralokasi']).' kg'" label="Tonase upah" ikon="bi-speedometer2" warna="success">
                <small>dijumlah per pemanen dari nota yang ia ikuti</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka(count($this->lembar['pemanen'])).' orang'" label="Pemanen dibayar" ikon="bi-people" warna="info">
                <small>
                    @if ($this->tampilan['rata_upah'] !== null)
                        @angka($this->tampilan['jumlah_dibayar']) sudah dibayar, rata-rata Rp @angka($this->tampilan['rata_upah']) per orang
                    @else
                        belum ada pemanen terdaftar yang dibayar
                    @endif
                </small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->lembar['jumlah_nota']).' nota'" label="Nota panen" ikon="bi-truck" warna="warning">
                <small>berat panen @angka($this->lembar['berat_total']) kg</small>
            </x-dashboard.kartu>

            {{-- Rincian upah dan pembagian tonase, bersebelahan dengan tinggi sama --}}
            <div class="col-xxl-8 mb-4">
                <x-kartu judul="Rincian upah pemanen" subjudul="Tonase tiap pemanen dikali tarif di Master Data. Nyalakan switch Status bayar setelah upahnya diserahkan ke pemanen." class="h-100" badan="p-0">
                    <div class="tabel-data">
                        <div class="table-responsive">
                            <table class="table mb-0 db-table">
                                <thead>
                                    <tr>
                                        <th>Pemanen</th>
                                        <th class="text-end d-none d-md-table-cell">Nota</th>
                                        <th class="text-end">Tonase upah</th>
                                        <th class="d-none d-lg-table-cell">Porsi tonase</th>
                                        <th class="text-end d-none d-sm-table-cell">Tarif</th>
                                        <th class="text-end">Upah</th>
                                        <th>Status bayar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->tampilan['pemanen'] as $orang)
                                        <tr wire:key="payroll-pemanen-{{ $orang['nama'] }}">
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    <span class="rounded-circle lingkar-34 bg-primary-subtle text-primary small fw-medium d-flex align-items-center justify-content-center flex-shrink-0" aria-hidden="true">{{ $orang['inisial'] }}</span>
                                                    <span class="fw-medium text-body">{{ $orang['nama'] }}</span>
                                                </div>
                                            </td>
                                            <td class="text-end d-none d-md-table-cell">@angka($orang['jumlah_nota'])</td>
                                            <td class="text-end text-nowrap">@angka($orang['berat_kg'], 2) kg</td>
                                            <td class="d-none d-lg-table-cell tabel-laporan__batang">
                                                <div class="d-flex align-items-center gap-2">
                                                    <div class="progress flex-grow-1" role="progressbar" aria-label="Porsi tonase {{ $orang['nama'] }}" aria-valuenow="{{ round($orang['porsi']) }}" aria-valuemin="0" aria-valuemax="100">
                                                        <div class="progress-bar bg-primary share-{{ max(0, min(100, (int) round($orang['porsi']))) }}"></div>
                                                    </div>
                                                    <span class="small text-body-secondary">@angka($orang['porsi'], 1)%</span>
                                                </div>
                                            </td>
                                            <td class="text-end d-none d-sm-table-cell text-nowrap">Rp @angka($orang['upah_per_kg'])/kg</td>
                                            <td class="text-end fw-semibold text-body text-nowrap">Rp @angka($orang['total_upah'])</td>
                                            <td>
                                                <div class="d-flex align-items-center gap-2">
                                                    {{-- Kunci berbeda per status: switch diganti elemen baru, karena memakai ulang elemen membuat centangnya tertinggal. --}}
                                                    <div class="form-check form-switch form-switch-success form-switch-sm mb-0" wire:key="status-bayar-{{ $orang['id'] }}-{{ $orang['dibayar'] ? 'sudah' : 'belum' }}">
                                                        @if ($orang['dibayar'])
                                                            {{-- Membatalkan pembayaran lewat modal konfirmasi; switch baru berubah setelah disetujui. --}}
                                                            <input
                                                                type="checkbox"
                                                                class="form-check-input"
                                                                id="dibayar-{{ $orang['id'] }}"
                                                                checked
                                                                x-on:click.prevent
                                                                wire:click="mintaBatalBayar({{ $orang['id'] }})"
                                                                data-bs-toggle="modal"
                                                                data-bs-target="#konfirmasi-batal-bayar"
                                                                @disabled($this->periode->tertutup())
                                                            >
                                                        @else
                                                            <input
                                                                type="checkbox"
                                                                class="form-check-input"
                                                                id="dibayar-{{ $orang['id'] }}"
                                                                wire:click="tandaiDibayar({{ $orang['id'] }})"
                                                                wire:loading.attr="disabled"
                                                                wire:target="tandaiDibayar"
                                                                @disabled($this->periode->tertutup())
                                                            >
                                                        @endif
                                                        <label class="form-check-label visually-hidden" for="dibayar-{{ $orang['id'] }}">Upah {{ $orang['nama'] }} sudah dibayar</label>
                                                    </div>
                                                    <div class="lh-sm">
                                                        @if ($orang['dibayar'])
                                                            <span class="d-block small fw-medium text-success text-nowrap">Sudah dibayar</span>
                                                            <span class="d-block small text-body-secondary text-nowrap">{{ $orang['dibayar']['pada']->translatedFormat('j M Y') }}</span>
                                                            @if ($orang['dibayar']['berubah'])
                                                                <span class="d-block small text-warning">Dibayar Rp @angka($orang['dibayar']['jumlah']); upah sekarang berubah</span>
                                                            @endif
                                                        @else
                                                            <span class="d-block small text-body-secondary text-nowrap">Belum dibayar</span>
                                                        @endif
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="7" class="text-center text-body-secondary">Belum ada tonase yang dapat dibayar ke pemanen terdaftar.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                                @if ($this->tampilan['pemanen'])
                                    <tfoot>
                                        <tr>
                                            <th>Total</th>
                                            <th class="d-none d-md-table-cell"></th>
                                            <th class="text-end text-nowrap">@angka($this->lembar['berat_teralokasi'], 2) kg</th>
                                            <th class="d-none d-lg-table-cell"></th>
                                            <th class="d-none d-sm-table-cell"></th>
                                            <th class="text-end text-nowrap">Rp @angka($this->lembar['total_upah'])</th>
                                            <th class="small fw-normal text-body-secondary text-nowrap">@angka($this->tampilan['jumlah_dibayar']) dari @angka(count($this->tampilan['pemanen'])) dibayar</th>
                                        </tr>
                                    </tfoot>
                                @endif
                            </table>
                        </div>
                    </div>
                </x-kartu>
            </div>

            <div class="col-xxl-4 mb-4">
                <x-kartu judul="Pembagian tonase upah" :subjudul="'Total '.\App\Support\Format::angka($this->tampilan['tonase_upah'], 2).' kg menurut status pembayarannya.'" class="h-100">
                    <ul class="list-unstyled mb-0">
                        @foreach ($this->tampilan['alokasi'] as $bagian)
                            <li @class(['mb-3' => ! $loop->last]) wire:key="alokasi-{{ $loop->index }}">
                                <div class="d-flex justify-content-between align-items-baseline gap-2 mb-1">
                                    <span class="fw-medium text-body">{{ $bagian['label'] }}</span>
                                    <span class="fw-medium text-body text-nowrap">@angka($bagian['berat_kg'], 2) kg</span>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="progress flex-grow-1" role="progressbar" aria-label="Porsi {{ $bagian['label'] }}" aria-valuenow="{{ round($bagian['persen']) }}" aria-valuemin="0" aria-valuemax="100">
                                        <div class="progress-bar bg-{{ $bagian['warna'] }} share-{{ max(0, min(100, (int) round($bagian['persen']))) }}"></div>
                                    </div>
                                    <span class="small text-body-secondary">@angka($bagian['persen'], 1)%</span>
                                </div>
                                <span class="d-block small text-body-secondary mt-1">{{ $bagian['keterangan'] }}</span>
                            </li>
                        @endforeach
                    </ul>

                    @if ($this->lembar['abk'])
                        <div class="border-top pt-3 mt-3">
                            <h6 class="fw-medium mb-2">ABK yang ikut memanen</h6>
                            <ul class="list-unstyled mb-0">
                                @foreach ($this->lembar['abk'] as $orang)
                                    <li class="d-flex justify-content-between gap-2 small mb-1" wire:key="abk-{{ $orang['nama'] }}">
                                        <span class="text-body">{{ $orang['nama'] }}</span>
                                        <span class="text-body-secondary text-nowrap">@angka($orang['berat_kg'], 2) kg</span>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    @endif
                </x-kartu>
            </div>

            {{-- Cara hitung --}}
            <div class="col-12 mb-4">
                <x-kartu judul="Cara menghitung tonase upah">
                    <ul class="daftar-poin small text-body-secondary mb-0">
                        <li>Nota dengan krat mulai: berat timbang aktual pemanen dipakai bila dicatat; sisa berat nota dibagi menurut jumlah krat di antara pemanen yang beratnya belum diisi.</li>
                        <li>Tanpa berat timbang aktual, berat nota dibagi menurut rentang krat tiap pemanen. Krat sebelum krat mulai pertama belum dialokasikan.</li>
                        <li>Nota lama tanpa krat mulai memakai seluruh berat nota untuk setiap nama yang tercatat, karena itu tonase upah bisa lebih besar dari berat panen.</li>
                        <li>Nama yang mengandung kata ABK, atau sama dengan nama karyawan ABK, tidak dibayar di sini. Data diubah di halaman Panen dan Master Data.</li>
                    </ul>
                </x-kartu>
            </div>
        @elseif ($this->periode)
            <x-kosong judul="Belum ada panen di periode ini">Payroll pemanen akan muncul setelah nota panen dicatat.</x-kosong>
        @else
            <x-kosong judul="Belum ada periode">Buat periode dan catat panen untuk menghitung payroll pemanen.</x-kosong>
        @endif
    </div>

    @if ($this->periode && ! $this->periode->tertutup())
        <x-konfirmasi id="konfirmasi-batal-bayar" judul="Batalkan status dibayar?" aksi="batalBayar" tombol="Ya, belum dibayar" warna="danger" memuat="mintaBatalBayar">
            Upah {{ $namaBatalBayar ?: 'pemanen ini' }} dikembalikan menjadi belum dibayar, dan catatan pembayarannya dihapus.
        </x-konfirmasi>
    @endif

    <x-memuat target="tandaiDibayar" teks="Menandai upah dibayar" />
    <x-memuat target="batalBayar" teks="Membatalkan status dibayar" />
</div>
