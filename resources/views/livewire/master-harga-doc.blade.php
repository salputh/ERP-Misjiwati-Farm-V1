<div class="col-lg-12 mb-30">
    <x-kartu judul="Master harga DOC" subjudul="Nilai global yang digunakan dalam perhitungan biaya DOC simulasi RHPP.">
        <x-slot:ekstra>
            <x-tombol ukuran="sm" variasi="shadow" wire:click="ubah" data-bs-toggle="modal" data-bs-target="#modal-harga-doc">
                Ubah master DOC
            </x-tombol>
        </x-slot:ekstra>

        {{-- Alert sukses --}}
        @if ($pesan)
        <x-peringatan warna="success" bisaDitutup="true">
            {{ $pesan }}
        </x-peringatan>
        @endif

        {{-- Tampilan nilai saat ini (komponen Statistic) --}}
        <div class="dm-statistics-wrap d-flex">
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Harga per ekor</span>
                <p class="statistics-item__number">
                    Rp {{ \App\Support\Format::angka($this->hargaDoc->harga_per_ekor) }}
                </p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Jumlah DOC</span>
                <p class="statistics-item__number">
                    {{ \App\Support\Format::angka($this->hargaDoc->jumlah_ekor) }}
                    <span class="text-gray fs-14">ekor</span>
                </p>
            </div>
        </div>
    </x-kartu>

    {{-- Form ubah (Modal) --}}
    <x-modal
        id="modal-harga-doc"
        judul="Ubah master DOC global"
        x-on:tutup-modal-harga-doc.window="bootstrap.Modal.getInstance($el).hide()" submit="simpan">
        
            <div class="row">
                <div class="col-md-6">
                    <x-masukan
                        id="harga-doc-harga"
                        label="Harga DOC per ekor (Rp)"
                        tipe="number"
                        min="1"
                        max="2147483647"
                        step="1"
                        wire:model="hargaPerEkor"
                        ukuran="lg"
                        :kesalahan="$errors->first('hargaPerEkor')" />
                </div>
                <div class="col-md-6">
                    <x-masukan
                        id="harga-doc-jumlah"
                        label="Jumlah DOC (ekor)"
                        tipe="number"
                        min="1"
                        max="2147483647"
                        step="1"
                        wire:model="jumlahEkor"
                        ukuran="lg"
                        :kesalahan="$errors->first('jumlahEkor')" />
                </div>
            </div>

            <x-slot:footer>
                <x-tombol warna="default" variasi="outlined" data-bs-dismiss="modal" wire:click="batal">
                    Batal
                </x-tombol>
                <x-tombol tipe="submit" class="px-30" wire:loading.attr="disabled" wire:target="simpan">
                    <span wire:loading.remove wire:target="simpan">Simpan</span>
                    <span wire:loading wire:target="simpan">Menyimpan...</span>
                </x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-memuat target="simpan" teks="Menyimpan harga DOC" />
</div>