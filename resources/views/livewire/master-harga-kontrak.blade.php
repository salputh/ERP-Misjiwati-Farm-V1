<div class="container-fluid">
    <div class="row">
        @if (! $this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Harga kontrak dapat dikelola setelah periode dibuat.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Daftar harga kontrak</h6>
                            <span class="fs-12 color-gray">{{ $this->periode->nama }} · Harga berdasarkan rentang bobot badan rata-rata (BW).</span>
                        </div>
                        <div class="card-extra">
                            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="master-data" />
                            <button type="button" class="btn btn-primary btn-xs btn-squared radius-md shadow2 btn-sm" wire:click="tambah">
                                Tambah bracket
                            </button>
                        </div>
                    </div>

                    <div class="card-body px-0">
                        @if ($pesan)
                            <div class="alert alert-success mb-25" role="status">
                                <div class="alert-content"><p>{{ $pesan }}</p></div>
                            </div>
                        @endif

                        @if ($formTerbuka)
                            <form wire:submit="simpan" class="card card-default card-md mb-25">
                                <div class="card-header">
                                    <h6>{{ $hargaKontrakId ? 'Ubah bracket harga' : 'Tambah bracket harga' }}</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row align-items-end">
                                        <div class="col-md-4 form-group mb-20">
                                            <label for="harga-kontrak-bobot-min" class="il-gray fs-14 fw-500 mb-10">BW Minimum (kg)</label>
                                            <input
                                                id="harga-kontrak-bobot-min"
                                                type="number"
                                                min="0"
                                                max="9.99"
                                                step="0.01"
                                                wire:model="bobotMinKg"
                                                @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('bobotMinKg')])
                                                placeholder="Contoh: 1.09"
                                            >
                                            @error('bobotMinKg')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                        </div>
                                        <div class="col-md-4 form-group mb-20">
                                            <label for="harga-kontrak-bobot-max" class="il-gray fs-14 fw-500 mb-10">BW Maksimum (kg)</label>
                                            <input
                                                id="harga-kontrak-bobot-max"
                                                type="number"
                                                min="0"
                                                max="9.99"
                                                step="0.01"
                                                wire:model="bobotMaxKg"
                                                @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('bobotMaxKg')])
                                                placeholder="Contoh: 1.19"
                                            >
                                            @error('bobotMaxKg')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                        </div>
                                        <div class="col-md-4 form-group mb-20">
                                            <label for="harga-kontrak-harga" class="il-gray fs-14 fw-500 mb-10">Harga Kontrak/kg (Rp)</label>
                                            <input
                                                id="harga-kontrak-harga"
                                                type="number"
                                                min="1"
                                                step="1"
                                                wire:model="hargaPerKg"
                                                @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('hargaPerKg')])
                                                placeholder="Contoh: 23150"
                                            >
                                            @error('hargaPerKg')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                        </div>
                                        <div class="col-12 form-group mb-20 d-flex gap-2">
                                            <button type="submit" class="btn btn-primary btn-sm" wire:loading.attr="disabled" wire:target="simpan">
                                                Simpan
                                            </button>
                                            <button type="button" class="btn btn-light btn-outlined btn-sm" wire:click="batal">
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        @endif

                        <div class="table-responsive">
                            <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                                <thead>
                                    <tr>
                                        <th class="text-end">BW Minimum (kg)</th>
                                        <th class="text-end">BW Maksimum (kg)</th>
                                        <th class="text-end">Harga Kontrak/kg</th>
                                        <th class="text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->daftar as $hargaKontrak)
                                        <tr wire:key="harga-kontrak-{{ $hargaKontrak->id }}">
                                            <td class="text-end">@angka($hargaKontrak->bobot_min_kg, 2)</td>
                                            <td class="text-end">@angka($hargaKontrak->bobot_max_kg, 2)</td>
                                            <td class="text-end">@angka($hargaKontrak->harga_per_kg)</td>
                                            <td class="text-end">
                                                <div class="dm-button-list d-inline-flex align-items-center gap-2">
                                                    <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubah({{ $hargaKontrak->id }})">
                                                        Ubah
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn btn-xs btn-squared btn-outline-danger"
                                                        wire:click="mintaHapus({{ $hargaKontrak->id }})"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#konfirmasi-hapus-harga-kontrak"
                                                        wire:loading.attr="disabled"
                                                        wire:target="mintaHapus, hapus"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="4" class="text-center py-30 color-gray">Belum ada bracket harga kontrak untuk periode ini.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan harga kontrak" />
    <x-konfirmasi id="konfirmasi-hapus-harga-kontrak" judul="Hapus bracket harga?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Rentang BW {{ $rentangHapus }} untuk {{ $this->periode?->nama }} akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
