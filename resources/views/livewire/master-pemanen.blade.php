<div class="col-12 mb-25" id="pemanen">
    <x-kartu judul="Daftar pemanen" subjudul="Kelola nama pemanen dan upah per kilogram hasil panen. Nama yang mengandung kata ABK, atau nama karyawan ABK, tidak dibayar di payroll pemanen." badan="p-0">
        <x-slot:ekstra>
            <x-tombol wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-pemanen">Tambah pemanen</x-tombol>
        </x-slot:ekstra>

        {{-- Tabel template (HexaDash: Basic Table, Basic Usage) --}}
        <div class="table4 p-25">
            @if ($pesan)
                <x-peringatan warna="success">{{ $pesan }}</x-peringatan>
            @endif

            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">No.</span></th>
                            <th><span class="userDatatable-title">Nama pemanen</span></th>
                            <th class="text-end"><span class="userDatatable-title">Upah per kg</span></th>
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($this->daftar as $pemanen)
                            <tr wire:key="pemanen-{{ $pemanen->id }}">
                                <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                <td>
                                    <div class="userDatatable-content fw-500">
                                        {{ $pemanen->nama }}
                                        @if (in_array($pemanen->id, $this->idAbk, true))
                                            <span class="dm-tag tag-warning tag-transparented ms-1" title="ABK yang ikut memanen tidak dibayar di payroll pemanen">ABK, tidak dibayar</span>
                                        @endif
                                    </div>
                                </td>
                                <td class="text-end"><div class="userDatatable-content">Rp @angka($pemanen->upah_per_kg)/kg</div></td>
                                <td>
                                    <x-aksi.ikon :aksi="[
                                        ['kelas' => 'edit', 'label' => 'Ubah pemanen '.$pemanen->nama, 'click' => 'ubah('.$pemanen->id.')', 'modal' => '#modal-pemanen'],
                                        ['kelas' => 'remove', 'label' => 'Hapus pemanen '.$pemanen->nama, 'click' => 'mintaHapus('.$pemanen->id.')', 'modal' => '#konfirmasi-hapus-pemanen'],
                                    ]" />
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="4" class="text-center color-light">Belum ada data pemanen.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </x-kartu>

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
                <x-tombol.batal wire:click="batal" />
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            </x-slot:footer>
        </x-modal>
</div>