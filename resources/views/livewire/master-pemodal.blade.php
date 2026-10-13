<div class="container-fluid">
    <div class="row">
    <div class="col-lg-12 mb-25">
        <div class="card border-0 px-25">
            <div class="card-header px-0 border-0">
                <div>
                    <h6>Daftar pemodal</h6>
                    <span class="fs-12 color-gray">Kelola pemodal dan porsi tetapnya pada tiap kandang. Jumlah porsi per kandang tidak boleh melebihi 100%.</span>
                </div>
                <div class="card-extra">
                    <button type="button" class="btn btn-primary btn-xs btn-squared radius-md shadow2 btn-sm" wire:click="tambah">
                        Tambah pemodal
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
                            <h6>{{ $pemodalId ? 'Ubah pemodal' : 'Tambah pemodal' }}</h6>
                        </div>
                        <div class="card-body">
                            <div class="row align-items-end">
                                <div class="col-md-6 form-group mb-20">
                                    <label for="pemodal-nama" class="il-gray fs-14 fw-500 mb-10">Nama pemodal</label>
                                    <input
                                        id="pemodal-nama"
                                        type="text"
                                        maxlength="150"
                                        wire:model="nama"
                                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('nama')])
                                        placeholder="Contoh: Muchrizan"
                                        autocomplete="off"
                                    >
                                    @error('nama')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                </div>

                                @foreach ($this->kandangs as $kandang)
                                    <div class="col-md-3 form-group mb-20" wire:key="porsi-input-{{ $kandang->id }}">
                                        <label for="pemodal-porsi-{{ $kandang->id }}" class="il-gray fs-14 fw-500 mb-10">Porsi {{ $kandang->nama }} (%)</label>
                                        <input
                                            id="pemodal-porsi-{{ $kandang->id }}"
                                            type="number"
                                            min="0.001"
                                            max="100"
                                            step="0.001"
                                            wire:model="porsiKandang.{{ $kandang->id }}"
                                            @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('porsiKandang.'.$kandang->id)])
                                            placeholder="Kosongkan jika tidak menerima bagian"
                                        >
                                        @error('porsiKandang.'.$kandang->id)<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                    </div>
                                @endforeach

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
                    <table class="table mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">No.</span></th>
                                <th><span class="userDatatable-title">Nama pemodal</span></th>
                                @foreach ($this->kandangs as $kandang)
                                    <th class="text-end"><span class="userDatatable-title">Porsi {{ $kandang->nama }}</span></th>
                                @endforeach
                                <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($this->daftar as $pemodal)
                                <tr wire:key="pemodal-{{ $pemodal->id }}">
                                    <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                    <td><div class="userDatatable-content fw-600">{{ $pemodal->nama }}</div></td>
                                    @foreach ($this->kandangs as $kandang)
                                        <td class="text-end">
                                            <div class="userDatatable-content">
                                                @php($porsi = $pemodal->kandangs->firstWhere('id', $kandang->id)?->pivot->persen)
                                                {{ $porsi === null ? '-' : \App\Support\Format::persen((float) $porsi) }}
                                            </div>
                                        </td>
                                    @endforeach
                                    <td class="text-end">
                                        <div class="dm-button-list d-inline-flex align-items-center gap-2">
                                            <button type="button" class="btn btn-xs btn-squared btn-outline-primary" wire:click="ubah({{ $pemodal->id }})">
                                                Ubah
                                            </button>
                                            <button
                                                type="button"
                                                class="btn btn-xs btn-squared btn-outline-danger"
                                                wire:click="mintaHapus({{ $pemodal->id }})"
                                                data-bs-toggle="modal"
                                                data-bs-target="#konfirmasi-hapus-pemodal"
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
                                    <td colspan="{{ 3 + $this->kandangs->count() }}" class="text-center py-30 color-gray">Belum ada pemodal.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan data pemodal" />
    <x-konfirmasi id="konfirmasi-hapus-pemodal" judul="Hapus pemodal?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Pemodal {{ $namaHapus }} akan dihapus beserta porsi kandangnya. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>

