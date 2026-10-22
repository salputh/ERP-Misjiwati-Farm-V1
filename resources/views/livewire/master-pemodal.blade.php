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
                        <x-tombol ukuran="sm" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-pemodal">
                            Tambah pemodal
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
                                    <td>
                                        <div class="userDatatable-content">{{ $loop->iteration }}</div>
                                    </td>
                                    <td>
                                        <div class="userDatatable-content fw-600">{{ $pemodal->nama }}</div>
                                    </td>
                                    @foreach ($this->kandangs as $kandang)
                                    <td class="text-end">
                                        <div class="userDatatable-content">
                                            @php($porsi = $pemodal->kandangs->firstWhere('id', $kandang->id)?->pivot->persen)
                                            {{ $porsi === null ? '-' : \App\Support\Format::persen((float) $porsi) }}
                                        </div>
                                    </td>
                                    @endforeach
                                    <td class="text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah pemodal '.$pemodal->nama, 'click' => 'ubah('.$pemodal->id.')', 'modal' => '#modal-pemodal'],
                                            ['kelas' => 'remove', 'label' => 'Hapus pemodal '.$pemodal->nama, 'click' => 'mintaHapus('.$pemodal->id.')', 'modal' => '#konfirmasi-hapus-pemodal'],
                                        ]" />
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
        Pemodal {{ $namaHapus }} akan dihapus dari farm ini beserta porsi kandangnya. Jika masih digunakan di farm lain, datanya tetap ada.
    </x-konfirmasi>

    <x-modal
        id="modal-pemodal"
        :judul="$pemodalId ? 'Ubah pemodal' : 'Tambah pemodal'"
        ukuran="lg"
        x-on:tutup-modal-pemodal.window="bootstrap.Modal.getInstance($el).hide()" submit="simpan">
        
            <div class="row">
                <div class="col-md-12">
                    <x-masukan
                        id="pemodal-nama"
                        label="Nama pemodal"
                        maxlength="150"
                        wire:model="nama"
                        :kesalahan="$errors->first('nama')"
                        placeholder="Contoh: Muchrizan"
                        autocomplete="off" />
                </div>

                @foreach ($this->kandangs as $kandang)
                    <div class="col-md-6" wire:key="porsi-input-{{ $kandang->id }}">
                        <x-masukan
                            id="pemodal-porsi-{{ $kandang->id }}"
                            label="Porsi {{ $kandang->nama }} (%)"
                            tipe="number"
                            min="0.001"
                            max="100"
                            step="0.001"
                            wire:model="porsiKandang.{{ $kandang->id }}"
                            :kesalahan="$errors->first('porsiKandang.'.$kandang->id)"
                            placeholder="Kosongkan jika tidak ada" />
                    </div>
                @endforeach
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