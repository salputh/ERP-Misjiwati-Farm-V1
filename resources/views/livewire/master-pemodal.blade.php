<div class="col-12 mb-25">
    <x-kartu judul="Daftar pemodal" subjudul="Kelola pemodal dan porsi tetapnya pada tiap kandang. Jumlah porsi per kandang tidak boleh melebihi 100%." badan="p-0">
        <x-slot:ekstra>
            <x-tombol wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-pemodal">Tambah pemodal</x-tombol>
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
                                <td><div class="userDatatable-content fw-500">{{ $pemodal->nama }}</div></td>
                                @foreach ($this->kandangs as $kandang)
                                    <td class="text-end">
                                        <div class="userDatatable-content">
                                            @if ($pemodal->porsiDi($kandang) !== null)
                                                {{ \App\Support\Format::persen($pemodal->porsiDi($kandang)) }}
                                            @else
                                                -
                                            @endif
                                        </div>
                                    </td>
                                @endforeach
                                <td>
                                    <x-aksi.ikon :aksi="[
                                        ['kelas' => 'edit', 'label' => 'Ubah pemodal '.$pemodal->nama, 'click' => 'ubah('.$pemodal->id.')', 'modal' => '#modal-pemodal'],
                                        ['kelas' => 'remove', 'label' => 'Hapus pemodal '.$pemodal->nama, 'click' => 'mintaHapus('.$pemodal->id.')', 'modal' => '#konfirmasi-hapus-pemodal'],
                                    ]" />
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="{{ 3 + $this->kandangs->count() }}" class="text-center color-light">Belum ada pemodal.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </x-kartu>

    <x-memuat target="simpan, hapus" teks="Menyimpan data pemodal" />
    <x-konfirmasi id="konfirmasi-hapus-pemodal" judul="Hapus pemodal?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Pemodal {{ $namaHapus }} akan dihapus dari farm ini beserta porsi kandangnya. Jika masih digunakan di farm lain, datanya tetap ada.
    </x-konfirmasi>

    <x-modal
        id="modal-pemodal"
        :judul="$pemodalId ? 'Ubah pemodal' : 'Tambah pemodal'"
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
                <x-tombol.batal wire:click="batal" />
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            </x-slot:footer>
        </x-modal>
</div>