<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Pakan dan stok" :jejak="['Produksi', 'Pakan dan stok']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="pakan.log" />
        </x-breadcrumb>

        @if ($this->log)
            <div class="col-xxl-9 mb-25">
                <div class="card border-0 px-25 h-100">
                    <div class="card-header px-0 border-0">
                        <h6>Log harian pemberian pakan</h6>
                        <div class="card-extra fs-14 color-gray tanpa-kapital">{{ $this->periode->nama }}, chick-in {{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</div>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <div class="recording-gulung" tabindex="0" role="region" aria-label="Log harian pemberian pakan, bisa digulir">
                            <table class="table table-bordered tabel-recording tabel-log mb-0">
                                <thead>
                                    <tr class="recording-kepala-1">
                                        <th>Tanggal</th>
                                        <th>Usia (hari)</th>
                                        <th>Jenis pakan</th>
                                        @foreach ($this->log['kandang'] as $nama)
                                            <th>{{ $nama }} (zak)</th>
                                        @endforeach
                                        <th>Total (zak)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($this->log['hari'] as $hari)
                                        @forelse ($hari['jenis'] as $pemberian)
                                            <tr wire:key="log-{{ $hari['umur'] }}-{{ $loop->index }}">
                                                @if ($loop->first)
                                                    <th scope="row" rowspan="{{ count($hari['jenis']) }}">{{ $hari['tanggal']->translatedFormat('D, j M Y') }}</th>
                                                    <td rowspan="{{ count($hari['jenis']) }}">{{ $hari['umur'] }}</td>
                                                @endif
                                                <td class="recording-masukan">{{ $pemberian['jenis'] ?? '-' }}</td>
                                                @foreach ($this->log['kandang'] as $id => $nama)
                                                    <td>
                                                        @isset($pemberian['zak'][$id])
                                                            @angka($pemberian['zak'][$id])
                                                        @else
                                                            -
                                                        @endisset
                                                    </td>
                                                @endforeach
                                                <td class="fw-600">@angka($pemberian['total'])</td>
                                            </tr>
                                        @empty
                                            <tr wire:key="log-{{ $hari['umur'] }}-kosong" class="recording-belum">
                                                <th scope="row">{{ $hari['tanggal']->translatedFormat('D, j M Y') }}</th>
                                                <td>{{ $hari['umur'] }}</td>
                                                <td>-</td>
                                                @foreach ($this->log['kandang'] as $nama)
                                                    <td>-</td>
                                                @endforeach
                                                <td>-</td>
                                            </tr>
                                        @endforelse
                                    @endforeach
                                </tbody>
                                <tfoot>
                                    <tr class="recording-minggu">
                                        <th scope="row" colspan="3">Total</th>
                                        @foreach ($this->log['kandang'] as $id => $nama)
                                            <td>@angka($this->log['total_kandang'][$id])</td>
                                        @endforeach
                                        <td>@angka($this->log['total'])</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xxl-3 mb-25">
                <div class="card border-0 px-25 h-100">
                    <div class="card-header px-0 border-0">
                        <h6>Sisa pakan per jenis</h6>
                    </div>
                    <div class="card-body p-0 pb-25">
                        @forelse ($this->log['per_jenis'] as $stok)
                            {{-- Satu sorotan per jenis pakan, warnanya bergiliran --}}
                            <div class="stok-jenis stok-jenis--{{ ['primary', 'info', 'warning', 'success', 'secondary'][$loop->index % 5] }}">
                                <div class="d-flex justify-content-between align-items-start gap-2">
                                    <span class="dm-tag stok-jenis__kode m-0">{{ $stok['jenis'] }}</span>
                                    @if ($stok['sisa'] === 0.0)
                                        <span class="stok-jenis__label">Habis</span>
                                    @elseif ($stok['terpakai'] === 0.0)
                                        <span class="stok-jenis__label">Belum dipakai</span>
                                    @endif
                                </div>

                                @isset($stok['sisa'])
                                    <p class="stok-jenis__sisa">@kurung($stok['sisa']) <small>zak tersisa</small></p>
                                    <p class="stok-jenis__rincian">
                                        @angka($stok['sisa'] * config('standar.kg_per_zak')) kg.
                                        Masuk @angka($stok['masuk']), terpakai @angka($stok['terpakai']) zak.
                                    </p>
                                    <div class="progress" role="progressbar" aria-label="Pemakaian {{ $stok['jenis'] }}" aria-valuenow="{{ round($stok['persen_terpakai'] ?? 0) }}" aria-valuemin="0" aria-valuemax="100">
                                        <div class="progress-bar" style="width: {{ $stok['persen_terpakai'] ?? 0 }}%"></div>
                                    </div>
                                @else
                                    <p class="stok-jenis__sisa">@angka($stok['terpakai']) <small>zak terpakai</small></p>
                                    <p class="stok-jenis__rincian">Sisa tidak dihitung karena jenis pakannya tidak dicatat.</p>
                                @endisset
                            </div>
                        @empty
                            <p class="color-gray">Belum ada pakan masuk atau pemberian pakan yang dicatat.</p>
                        @endforelse

                        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0 mt-20">
                            <tbody>
                                <tr>
                                    <td>Pakan masuk</td>
                                    <td class="text-end">@angka($this->log['total_stok']['masuk']) zak</td>
                                </tr>
                                <tr>
                                    <td>Terpakai menurut log</td>
                                    <td class="text-end">@angka($this->log['total_stok']['terpakai']) zak</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th>Sisa belum terpakai</th>
                                    <th @class(['text-end', 'color-danger' => $this->log['total_stok']['sisa'] < 0])>
                                        @isset($this->log['total_stok']['sisa'])
                                            @kurung($this->log['total_stok']['sisa']) zak
                                        @else
                                            -
                                        @endisset
                                    </th>
                                </tr>
                            </tfoot>
                        </table>
                        <p class="fs-12 color-gray mt-15 mb-0">Sisa = pakan masuk dikurangi pemberian di log. Satu zak = @angka(config('standar.kg_per_zak')) kg.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Log pemberian pakan muncul setelah periode dibuat dan kandangnya diisi.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>
</div>
