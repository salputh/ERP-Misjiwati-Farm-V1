<div class="col-12 mb-25" id="premi-abk">
    <x-kartu judul="Premi ABK" subjudul="Estimasi hasil kandang koloni per ekor (4 ABK). Premi pemeliharaan ABK di RHPP dan bagi hasil diambil dari baris tertinggi yang dicapai total budidaya per ekor populasi; di bawah baris terendah, premi Rp 0." badan="p-0">
        <x-slot:ekstra>
            <x-tombol wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-premi-abk">Tambah baris</x-tombol>
        </x-slot:ekstra>

        {{-- Tabel template (HexaDash: Basic Table, Basic Usage) --}}
        <div class="table4 p-25">
            @if ($pesan)
                <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
            @endif

            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">No.</span></th>
                            <th class="text-end"><span class="userDatatable-title">Hasil per ekor</span></th>
                            <th class="text-end"><span class="userDatatable-title">Intensif</span></th>
                            <th class="text-end"><span class="userDatatable-title">Premi ABK</span></th>
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($this->daftar as $baris)
                            <tr wire:key="premi-abk-{{ $baris->id }}">
                                <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                <td class="text-end"><div class="userDatatable-content fw-500">≥ Rp @angka($baris->hasil_per_ekor)</div></td>
                                <td class="text-end"><div class="userDatatable-content">@angka($baris->intensif)</div></td>
                                <td class="text-end"><div class="userDatatable-content">Rp @angka($baris->premi)</div></td>
                                <td>
                                    <x-aksi.ikon :aksi="[
                                        ['kelas' => 'edit', 'label' => 'Ubah premi ABK Rp '.\App\Support\Format::angka($baris->hasil_per_ekor).' per ekor', 'click' => 'ubah('.$baris->id.')', 'modal' => '#modal-premi-abk'],
                                        ['kelas' => 'remove', 'label' => 'Hapus premi ABK Rp '.\App\Support\Format::angka($baris->hasil_per_ekor).' per ekor', 'click' => 'mintaHapus('.$baris->id.')', 'modal' => '#konfirmasi-hapus-premi-abk'],
                                    ]" />
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center color-light">Belum ada baris premi ABK. Tanpa tabel ini, premi pemeliharaan ABK dihitung Rp 0.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </x-kartu>

    <x-modal
        id="modal-premi-abk"
        :judul="$premiId ? 'Ubah baris premi ABK' : 'Tambah baris premi ABK'"
        x-on:tutup-modal-premi-abk.window="bootstrap.Modal.getInstance($el).hide()"
        submit="simpan">
        <div class="row">
            <div class="col-md-4">
                <x-masukan.ribuan id="premi-abk-hasil" properti="hasilPerEkor" label="Hasil per ekor (Rp)" placeholder="Contoh: 5.500" keterangan="Batas bawah total budidaya per ekor." :kesalahan="$errors->first('hasilPerEkor')" wire:key="premi-abk-hasil-{{ $premiId ?? 'baru' }}" />
            </div>
            <div class="col-md-4">
                <x-masukan.ribuan id="premi-abk-intensif" properti="intensif" label="Intensif" placeholder="Contoh: 50" :kesalahan="$errors->first('intensif')" wire:key="premi-abk-intensif-{{ $premiId ?? 'baru' }}" />
            </div>
            <div class="col-md-4">
                <x-masukan.ribuan id="premi-abk-premi" properti="premi" label="Premi ABK (Rp)" placeholder="Contoh: 1.050.000" :kesalahan="$errors->first('premi')" wire:key="premi-abk-premi-{{ $premiId ?? 'baru' }}" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            @if ($premiId)
                <x-tombol tipe="button" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-premi-abk" wire:loading.attr="disabled" wire:target="simpan, hapus">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    @if ($premiId)
        <x-konfirmasi id="konfirmasi-simpan-premi-abk" judul="Simpan perubahan premi ABK?" aksi="simpan" tombol="Ya, simpan perubahan">
            Premi pemeliharaan ABK di RHPP dan bagi hasil setiap kandang dihitung ulang memakai tabel ini.
        </x-konfirmasi>
    @endif

    <x-konfirmasi id="konfirmasi-hapus-premi-abk" judul="Hapus baris premi ABK?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
        Baris ini dihapus permanen. Premi pemeliharaan ABK di RHPP dan bagi hasil dihitung ulang tanpa baris ini.
    </x-konfirmasi>

    <x-memuat target="simpan" teks="Menyimpan premi ABK" />
    <x-memuat target="hapus" teks="Menghapus premi ABK" />
</div>
