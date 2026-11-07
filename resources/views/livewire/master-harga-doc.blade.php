<div class="col-12 mb-4">
    <x-kartu judul="Master harga DOC" subjudul="Nilai global yang digunakan dalam perhitungan biaya DOC simulasi RHPP.">
        <x-slot:ekstra>
            <x-tombol wire:click="ubah" data-bs-toggle="modal" data-bs-target="#modal-harga-doc">Ubah master DOC</x-tombol>
        </x-slot:ekstra>

        @if ($pesan)
            <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
        @endif

        {{-- Statistik template  --}}
        <div class="d-flex">
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Harga per ekor</span>
                <p class="h5 mb-0">Rp @angka($this->hargaDoc->harga_per_ekor)</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Jumlah DOC</span>
                <p class="h5 mb-0">@angka($this->hargaDoc->jumlah_ekor) ekor</p>
            </div>
        </div>
    </x-kartu>

    <x-modal
        id="modal-harga-doc"
        judul="Ubah master DOC global"
        x-on:tutup-modal-harga-doc.window="bootstrap.Modal.getInstance($el).hide()"
        submit="simpan">
        <div class="row">
            <div class="col-md-6">
                <x-masukan.ribuan properti="hargaPerEkor" teks
                    id="harga-doc-harga"
                    label="Harga DOC per ekor (Rp)"
                   
                   
                   
                   
                   
                    :kesalahan="$errors->first('hargaPerEkor')" />
            </div>
            <div class="col-md-6">
                <x-masukan.ribuan properti="jumlahEkor" teks
                    id="harga-doc-jumlah"
                    label="Jumlah DOC (ekor)"
                   
                   
                   
                   
                   
                    :kesalahan="$errors->first('jumlahEkor')" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-memuat target="simpan" teks="Menyimpan harga DOC" />
</div>
