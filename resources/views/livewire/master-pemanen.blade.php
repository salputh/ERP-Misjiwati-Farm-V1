<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <div>
                <h6>Daftar pemanen</h6>
                <span class="fs-12 color-gray">Kelola nama pemanen dan upah per kilogram hasil panen.</span>
            </div>
            <div class="card-extra">
                <x-tombol ukuran="sm" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-pemanen">
                    Tambah pemanen
                </x-tombol>
            </div>
        </div>

        <div class="card-body px-0">
            @if ($pesan)
            <x-peringatan warna="success" class="mb-25">
                {{ $pesan }}
            </x-peringatan>
            @endif

            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">No.</span></th>
                            <th><span class="userDatatable-title">Nama pemanen</span></th>
                            <th><span class="userDatatable-title">Upah per kg</span></th>
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($this->daftar as $pemanen)
                        <tr wire:key="pemanen-{{ $pemanen->id }}">
                            <td>
                                <div class="userDatatable-content">{{ $loop->iteration }}</div>
                            </td>
                            <td>
                                <div class="userDatatable-content fw-600">{{ $pemanen->nama }}</div>
                            </td>
                            <td>
                                <div class="userDatatable-content">Rp {{ \App\Support\Format::angka($pemanen->upah_per_kg) }}/kg</div>
                            </td>
                            <td class="text-end">
                                <x-aksi.ikon :aksi="[
                                    ['kelas' => 'edit', 'label' => 'Ubah pemanen '.$pemanen->nama, 'click' => 'ubah('.$pemanen->id.')', 'modal' => '#modal-pemanen'],
                                    ['kelas' => 'remove', 'label' => 'Hapus pemanen '.$pemanen->nama, 'click' => 'mintaHapus('.$pemanen->id.')', 'modal' => '#konfirmasi-hapus-pemanen'],
                                ]" />
                            </td>
                        </tr>
                        @empty
                        <tr>
                            <td colspan="4" class="text-center py-30 color-gray">Belum ada data pemanen.</td>
                        </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan data pemanen" />
    <x-konfirmasi id="konfirmasi-hapus-pemanen" judul="Hapus pemanen?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Data pemanen {{ $namaHapus }} akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>

    <x-modal 
        id="modal-pemanen" 
        :judul="$pemanenId ? 'Ubah pemanen' : 'Tambah pemanen'"
        x-on:tutup-modal-pemanen.window="bootstrap.Modal.getInstance($el).hide()" submit="simpan">
        
            <div class="row">
                <div class="col-md-6">
                    <x-masukan
                        id="pemanen-nama"
                        label="Nama pemanen"
                        maxlength="150"
                        wire:model="nama"
                        :kesalahan="$errors->first('nama')"
                        placeholder="Masukkan nama pemanen"
                        autocomplete="off" />
                </div>
                <div class="col-md-6">
                    <x-masukan
                        id="pemanen-upah"
                        label="Upah per kg (Rp)"
                        tipe="number"
                        min="0"
                        max="2147483647"
                        step="1"
                        wire:model="upahPerKg"
                        :kesalahan="$errors->first('upahPerKg')"
                        placeholder="Contoh: 20" />
                </div>
            </div>

            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="batal">
                    Batal
                </x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">
                    Simpan
                </x-tombol>
            </x-slot:footer>
        </x-modal>
</div>