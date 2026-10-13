<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Pakan dan stok" :jejak="['Produksi', 'Pakan dan stok']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="pakan.log" />
        </x-breadcrumb>

        @if ($this->log)
            @if ($pesan)
                <div class="col-12 mb-25">
                    <div class="alert alert-success" role="status">
                        <div class="alert-content"><p>{{ $pesan }}</p></div>
                    </div>
                </div>
            @endif

            <div class="col-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Daftar pakan masuk</h6>
                            <span class="fs-12 color-gray">{{ $this->periode->nama }}</span>
                        </div>
                        <button type="button" class="btn btn-primary btn-xs btn-squared btn-sm" wire:click="tambahPenerimaan" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPenerimaan, simpan">
                            Tambah pakan masuk
                        </button>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <div class="table-responsive">
                            <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Jenis pakan</th>
                                        <th class="text-end">Jumlah (zak)</th>
                                        <th class="text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->daftarPenerimaan as $penerimaan)
                                        <tr wire:key="penerimaan-pakan-{{ $penerimaan->id }}">
                                            <td>{{ $penerimaan->tanggal->translatedFormat('j M Y') }}</td>
                                            <td>{{ $penerimaan->jenisPakan?->kode ?? 'Tidak diketahui' }}</td>
                                            <td class="text-end">@angka($penerimaan->zak, 1)</td>
                                            <td class="text-end">
                                                <div class="dm-button-list d-inline-flex align-items-center gap-2">
                                                    <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubahPenerimaan({{ $penerimaan->id }})" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="ubahPenerimaan, simpan">Ubah</button>
                                                    <button type="button" class="btn btn-xs btn-squared btn-outline-danger" wire:click="mintaHapusPenerimaan({{ $penerimaan->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-pakan" wire:loading.attr="disabled" wire:target="mintaHapusPenerimaan, hapus">Hapus</button>
                                                </div>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr><td colspan="4" class="text-center py-30 color-gray">Belum ada pakan masuk.</td></tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xxl-9 mb-25">
                <div class="card border-0 px-25 h-100">
                    <div class="card-header px-0 border-0">
                        <h6>Log harian pemberian pakan</h6>
                        <div class="card-extra d-flex align-items-center gap-3">
                            <span class="fs-14 color-gray tanpa-kapital">{{ $this->periode->nama }}, chick-in {{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</span>
                            <button type="button" class="btn btn-primary btn-xs btn-squared btn-sm" wire:click="tambahPemberian" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPemberian, simpan">
                                Tambah pemberian
                            </button>
                        </div>
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
                                        <th>Total (kg)</th>
                                        <th>Aksi</th>
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
                                                <td class="fw-600">@angka($pemberian['berat_kg'])</td>
                                                <td>
                                                    <div class="d-flex flex-column align-items-center gap-2">
                                                        @foreach ($this->log['kandang'] as $id => $nama)
                                                            @foreach ($pemberian['catatan'][$id] ?? [] as $catatan)
                                                                <div wire:key="aksi-pemberian-{{ $catatan['id'] }}">
                                                                    <div class="d-flex align-items-center gap-1">
                                                                        <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubahPemberian({{ $catatan['id'] }})" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="ubahPemberian, simpan">Ubah</button>
                                                                        <button type="button" class="btn btn-xs btn-squared btn-outline-danger" wire:click="mintaHapusPemberian({{ $catatan['id'] }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-pakan" wire:loading.attr="disabled" wire:target="mintaHapusPemberian, hapus">Hapus</button>
                                                                    </div>
                                                                </div>
                                                            @endforeach
                                                        @endforeach
                                                    </div>
                                                </td>
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
                                        <td>@angka($this->log['total_kg'])</td>
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
                                        @angka($stok['sisa_kg']) kg.
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
                                    <td class="text-end">@angka($this->log['total_stok']['masuk']) zak · @angka($this->log['total_stok']['masuk_kg']) kg</td>
                                </tr>
                                <tr>
                                    <td>Terpakai menurut log</td>
                                    <td class="text-end">@angka($this->log['total_stok']['terpakai_kg']) kg</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th>Sisa belum terpakai</th>
                                    <th @class(['text-end', 'color-danger' => $this->log['total_stok']['sisa'] < 0])>
                                        @isset($this->log['total_stok']['sisa'])
                                            @kurung($this->log['total_stok']['sisa']) zak · @kurung($this->log['total_stok']['sisa_kg']) kg
                                        @else
                                            -
                                        @endisset
                                    </th>
                                </tr>
                            </tfoot>
                        </table>
                        <p class="fs-12 color-gray mt-15 mb-0">Konversi kg memakai berat per zak pada master tiap jenis pakan. Pemberian tanpa jenis memakai standar @angka(config('standar.kg_per_zak')) kg/zak.</p>
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

    @if ($this->log)
        <div class="modal-basic modal fade" id="modal-form-pakan" tabindex="-1" aria-labelledby="judul-modal-form-pakan" aria-hidden="true" wire:ignore.self x-on:pakan-disimpan.window="$el.querySelector('[data-bs-dismiss=modal]').click()">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content modal-bg-white">
                    <div class="modal-header">
                        <h6 class="modal-title" id="judul-modal-form-pakan">
                            {{ $catatanId ? 'Ubah' : 'Tambah' }}
                            {{ $tipeForm === 'penerimaan' ? 'pakan masuk' : 'pemberian pakan' }}
                        </h6>
                        <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup" wire:click="batal">
                            <i class="uil uil-times"></i>
                        </button>
                    </div>
                    <form wire:submit="simpan">
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6 form-group mb-20">
                                    <label for="pakan-tanggal" class="il-gray fs-14 fw-500 mb-10">Tanggal</label>
                                    <input
                                        id="pakan-tanggal"
                                        type="date"
                                        min="{{ $this->batasTanggal['min'] }}"
                                        max="{{ $this->batasTanggal['max'] }}"
                                        wire:model="tanggal"
                                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('tanggal')])
                                    >
                                    @error('tanggal')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                </div>
                                <div class="col-md-6 form-group mb-20">
                                    <label for="pakan-jenis" class="il-gray fs-14 fw-500 mb-10">Jenis pakan</label>
                                    <select
                                        id="pakan-jenis"
                                        wire:model="jenisPakanId"
                                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('jenisPakanId')])
                                    >
                                        <option value="">Tidak diketahui / belum dicatat</option>
                                        @foreach ($this->daftarJenisPakan as $jenisPakan)
                                            <option value="{{ $jenisPakan->id }}">{{ $jenisPakan->kode }}</option>
                                        @endforeach
                                    </select>
                                    @error('jenisPakanId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                </div>
                                @if ($tipeForm === 'pemberian')
                                    <div class="col-md-6 form-group mb-20">
                                        <label for="pakan-kandang" class="il-gray fs-14 fw-500 mb-10">Kandang</label>
                                        <select
                                            id="pakan-kandang"
                                            wire:model="periodeKandangId"
                                            @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('periodeKandangId')])
                                        >
                                            <option value="">Pilih kandang</option>
                                            @foreach ($this->daftarKandang as $kandang)
                                                <option value="{{ $kandang->id }}">{{ $kandang->kandang->nama }}</option>
                                            @endforeach
                                        </select>
                                        @error('periodeKandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                    </div>
                                @endif
                                <div class="col-md-6 form-group mb-20">
                                    <label for="pakan-zak" class="il-gray fs-14 fw-500 mb-10">Jumlah (zak)</label>
                                    <input
                                        id="pakan-zak"
                                        type="number"
                                        min="0.1"
                                        max="9999999.9"
                                        step="0.1"
                                        wire:model="zak"
                                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('zak')])
                                        placeholder="Contoh: 25"
                                    >
                                    @error('zak')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-light btn-outlined btn-sm" data-bs-dismiss="modal" wire:click="batal">Batal</button>
                            <button type="submit" class="btn btn-primary btn-sm" wire:loading.attr="disabled" wire:target="simpan">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        <x-memuat target="simpan, hapus" teks="Menyimpan catatan pakan" />
        <x-konfirmasi id="konfirmasi-hapus-pakan" judul="Hapus catatan pakan?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
            {{ $catatanHapus }} akan dihapus. Perubahan ini juga mengubah perhitungan stok. Tindakan ini tidak dapat dibatalkan.
        </x-konfirmasi>
    @endif
</div>
