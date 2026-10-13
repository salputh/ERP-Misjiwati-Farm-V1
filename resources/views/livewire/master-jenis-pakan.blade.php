<div class="container-fluid">
    <div class="row">
        <div class="col-lg-12 mb-25">
            <div class="card border-0 px-25">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Daftar jenis pakan</h6>
                        <span class="fs-12 color-gray">Kelola kode, harga, dan berat tiap jenis pakan.</span>
                    </div>
                    <div class="card-extra">
                        <button type="button" class="btn btn-primary btn-xs btn-squared radius-md shadow2 btn-sm" wire:click="tambah">
                            Tambah jenis pakan
                        </button>
                    </div>
                </div>

                <div class="card-body px-0">
                    @if ($pesan)
                        <div class="alert alert-success mb-25" role="status">
                            <div class="alert-content"><p>{{ $pesan }}</p></div>
                        </div>
                    @endif

                    @error('hapus')
                        <div class="alert alert-danger mb-25" role="alert">
                            <div class="alert-content"><p>{{ $message }}</p></div>
                        </div>
                    @enderror

                    @if ($formTerbuka)
                        <form wire:submit="simpan" class="card card-default card-md mb-25">
                            <div class="card-header">
                                <h6>{{ $jenisPakanId ? 'Ubah jenis pakan' : 'Tambah jenis pakan' }}</h6>
                            </div>
                            <div class="card-body">
                                <div class="row align-items-end">
                                    <div class="col-md-4 form-group mb-20">
                                        <label for="jenis-pakan-kode" class="il-gray fs-14 fw-500 mb-10">Kode jenis pakan</label>
                                        <input
                                            id="jenis-pakan-kode"
                                            type="text"
                                            maxlength="50"
                                            wire:model="kode"
                                            @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('kode')])
                                            placeholder="Contoh: SB-10"
                                            autocomplete="off"
                                        >
                                        @error('kode')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                    </div>
                                    <div class="col-md-4 form-group mb-20">
                                        <label for="jenis-pakan-harga" class="il-gray fs-14 fw-500 mb-10">Harga per kg (Rp)</label>
                                        <input
                                            id="jenis-pakan-harga"
                                            type="number"
                                            min="1"
                                            step="1"
                                            wire:model="hargaPerKg"
                                            @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('hargaPerKg')])
                                            placeholder="Contoh: 8500"
                                        >
                                        @error('hargaPerKg')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                    </div>
                                    <div class="col-md-4 form-group mb-20">
                                        <label for="jenis-pakan-berat" class="il-gray fs-14 fw-500 mb-10">Berat per zak (kg)</label>
                                        <input
                                            id="jenis-pakan-berat"
                                            type="number"
                                            min="0.01"
                                            max="999999.99"
                                            step="0.01"
                                            wire:model="kgPerZak"
                                            @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('kgPerZak')])
                                            placeholder="Contoh: 50"
                                        >
                                        @error('kgPerZak')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                    </div>
                                    <div class="col-md-12 form-group mb-20 d-flex gap-2">
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
                        <table class="table mb-0">
                            <thead>
                                <tr class="userDatatable-header">
                                    <th><span class="userDatatable-title">No.</span></th>
                                    <th><span class="userDatatable-title">Kode jenis pakan</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Harga/kg</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Kg/zak</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->daftar as $jenisPakan)
                                    <tr wire:key="jenis-pakan-{{ $jenisPakan->id }}">
                                        <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                        <td><div class="userDatatable-content fw-600">{{ $jenisPakan->kode }}</div></td>
                                        <td class="text-end"><div class="userDatatable-content">{{ $jenisPakan->harga_per_kg === null ? '-' : 'Rp '.\App\Support\Format::angka($jenisPakan->harga_per_kg) }}</div></td>
                                        <td class="text-end"><div class="userDatatable-content">@angka($jenisPakan->kg_per_zak, 2)</div></td>
                                        <td class="text-end">
                                            <div class="dm-button-list d-inline-flex align-items-center gap-2">
                                                <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubah({{ $jenisPakan->id }})">
                                                    Ubah
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn btn-xs btn-squared btn-outline-danger"
                                                    wire:click="mintaHapus({{ $jenisPakan->id }})"
                                                    data-bs-toggle="modal"
                                                    data-bs-target="#konfirmasi-hapus-jenis-pakan"
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
                                        <td colspan="5" class="text-center py-30 color-gray">Belum ada jenis pakan.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan jenis pakan" />
    <x-konfirmasi id="konfirmasi-hapus-jenis-pakan" judul="Hapus jenis pakan?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Jenis pakan {{ $kodeHapus }} akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
