<div class="col-12 mb-25">
    @if (! $this->periode)
        <x-kartu judul="Daftar harga kontrak">
            <p class="color-gray mb-0">Belum ada periode. Harga kontrak dapat dikelola setelah periode dibuat.</p>
        </x-kartu>
    @else
        <x-kartu judul="Daftar harga kontrak" subjudul="Harga berdasarkan rentang bobot badan rata-rata (BW)." badan="p-0">
            <x-slot:ekstra>
                <x-tombol wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-harga-kontrak">Tambah bracket</x-tombol>
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
                                <th class="text-end"><span class="userDatatable-title">BW Minimum (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">BW Maksimum (kg)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Harga Kontrak/kg</span></th>
                                <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($this->daftar as $hargaKontrak)
                                <tr wire:key="harga-kontrak-{{ $hargaKontrak->id }}">
                                    <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                    <td class="text-end"><div class="userDatatable-content">@angka($hargaKontrak->bobot_min_kg, 2)</div></td>
                                    <td class="text-end"><div class="userDatatable-content">@angka($hargaKontrak->bobot_max_kg, 2)</div></td>
                                    <td class="text-end"><div class="userDatatable-content">Rp @angka($hargaKontrak->harga_per_kg)</div></td>
                                    <td>
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah bracket harga', 'click' => 'ubah('.$hargaKontrak->id.')', 'modal' => '#modal-harga-kontrak'],
                                            ['kelas' => 'remove', 'label' => 'Hapus bracket harga', 'click' => 'mintaHapus('.$hargaKontrak->id.')', 'modal' => '#konfirmasi-hapus-harga-kontrak'],
                                        ]" />
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="5" class="text-center color-light">Belum ada bracket harga kontrak untuk periode ini.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </x-kartu>
    @endif

    <x-memuat target="simpan, hapus" teks="Menyimpan harga kontrak" />
    <x-konfirmasi id="konfirmasi-hapus-harga-kontrak" judul="Hapus bracket harga?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Rentang BW {{ $rentangHapus }} untuk periode terpilih akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>

    <x-modal
        id="modal-harga-kontrak"
        :judul="$hargaKontrakId ? 'Ubah bracket harga' : 'Tambah bracket harga'"
        x-on:tutup-modal-harga-kontrak.window="bootstrap.Modal.getInstance($el).hide()"
        submit="simpan">
        <div class="row">
            <div class="col-md-6">
                <x-masukan
                    id="harga-kontrak-bobot-min"
                    label="BW Minimum (kg)"
                    tipe="number"
                    min="0"
                    max="9.99"
                    step="0.01"
                    wire:model="bobotMinKg"
                    :kesalahan="$errors->first('bobotMinKg')"
                    placeholder="Contoh: 1.09" />
            </div>
            <div class="col-md-6">
                <x-masukan
                    id="harga-kontrak-bobot-max"
                    label="BW Maksimum (kg)"
                    tipe="number"
                    min="0"
                    max="9.99"
                    step="0.01"
                    wire:model="bobotMaxKg"
                    :kesalahan="$errors->first('bobotMaxKg')"
                    placeholder="Contoh: 1.19" />
            </div>
            <div class="col-12">
                <x-masukan.ribuan properti="hargaPerKg" teks
                    id="harga-kontrak-harga"
                    label="Harga Kontrak/kg (Rp)"
                   
                   
                   
                   
                    :kesalahan="$errors->first('hargaPerKg')"
                    placeholder="Contoh: 23150" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
        </x-slot:footer>
    </x-modal>
</div>
