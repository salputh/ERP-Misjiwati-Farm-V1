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
                        <x-tombol ukuran="sm" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-jenis-pakan">
                            Tambah jenis pakan
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
                                    <th><span class="userDatatable-title">Kode jenis pakan</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Harga/kg</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Kg/zak</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->daftar as $jenisPakan)
                                <tr wire:key="jenis-pakan-{{ $jenisPakan->id }}">
                                    <td>
                                        <div class="userDatatable-content">{{ $loop->iteration }}</div>
                                    </td>
                                    <td>
                                        <div class="userDatatable-content fw-600">{{ $jenisPakan->kode }}</div>
                                    </td>
                                    <td class="text-end">
                                        <div class="userDatatable-content">{{ $jenisPakan->harga_per_kg === null ? '-' : 'Rp '.\App\Support\Format::angka($jenisPakan->harga_per_kg) }}</div>
                                    </td>
                                    <td class="text-end">
                                        <div class="userDatatable-content">@angka($jenisPakan->kg_per_zak, 2)</div>
                                    </td>
                                    <td class="text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah jenis pakan '.$jenisPakan->kode, 'click' => 'ubah('.$jenisPakan->id.')', 'modal' => '#modal-jenis-pakan'],
                                            ['kelas' => 'remove', 'label' => 'Hapus jenis pakan '.$jenisPakan->kode, 'click' => 'mintaHapus('.$jenisPakan->id.')', 'modal' => '#konfirmasi-hapus-jenis-pakan'],
                                        ]" />
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

    <x-modal 
        id="modal-jenis-pakan" 
        :judul="$jenisPakanId ? 'Ubah jenis pakan' : 'Tambah jenis pakan'"
        ukuran="lg"
        x-on:tutup-modal-jenis-pakan.window="bootstrap.Modal.getInstance($el).hide()" submit="simpan">
        
            <div class="row">
                <div class="col-md-12">
                    <x-masukan
                        id="jenis-pakan-kode"
                        label="Kode jenis pakan"
                        maxlength="50"
                        wire:model="kode"
                        :kesalahan="$errors->first('kode')"
                        placeholder="Contoh: SB-10"
                        autocomplete="off" />
                </div>
                <div class="col-md-6">
                    <x-masukan
                        id="jenis-pakan-harga"
                        label="Harga per kg (Rp)"
                        tipe="number"
                        min="1"
                        step="1"
                        wire:model="hargaPerKg"
                        :kesalahan="$errors->first('hargaPerKg')"
                        placeholder="Contoh: 8500" />
                </div>
                <div class="col-md-6">
                    <x-masukan
                        id="jenis-pakan-berat"
                        label="Berat per zak (kg)"
                        tipe="number"
                        min="0.01"
                        max="999999.99"
                        step="0.01"
                        wire:model="kgPerZak"
                        :kesalahan="$errors->first('kgPerZak')"
                        placeholder="Contoh: 50" />
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