<div class="col-12 mb-25">
    <x-kartu judul="Uang makan" subjudul="Dipotong dari slip gaji setiap ABK setelah RHPP periode itu keluar. Jabatan lain tidak dipotong.">
        <x-slot:ekstra>
            <x-tombol wire:click="ubah" data-bs-toggle="modal" data-bs-target="#modal-uang-makan">Ubah uang makan</x-tombol>
        </x-slot:ekstra>

        @if ($pesan)
            <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
        @endif

        {{-- Statistik template (HexaDash: Statistics, Basic) --}}
        <div class="dm-statistics-wrap d-flex flex-wrap">
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Per orang per hari</span>
                <p class="statistics-item__number">Rp @angka($this->uangMakan['per_hari'])</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Jumlah hari</span>
                <p class="statistics-item__number">@angka($this->uangMakan['hari']) hari</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Dipotong per ABK</span>
                <p class="statistics-item__number">Rp @angka($this->uangMakan['total'])</p>
            </div>
        </div>

        <p class="fs-13 color-light mt-15 mb-0">
            ABK yang sudah punya transaksi Pinjaman Makan atas namanya di kas operasional dipotong sebesar transaksi itu, bukan nilai bawaan ini.
        </p>
    </x-kartu>

    <x-modal
        id="modal-uang-makan"
        judul="Ubah uang makan"
        x-on:tutup-modal-uang-makan.window="bootstrap.Modal.getInstance($el).hide()"
        aksi-tutup="batal"
        submit="simpan">
        <div class="row">
            <div class="col-md-6">
                <x-masukan.ribuan properti="perHari" teks id="uang-makan-per-hari" label="Per orang per hari (Rp)" :kesalahan="$errors->first('perHari')" />
            </div>
            <div class="col-md-6">
                <x-masukan id="uang-makan-hari" label="Jumlah hari" tipe="number" min="0" max="366" step="1" wire:model="hari" :kesalahan="$errors->first('hari')" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            <x-tombol data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-uang-makan" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-konfirmasi id="konfirmasi-simpan-uang-makan" judul="Simpan perubahan uang makan?" aksi="simpan" tombol="Ya, simpan perubahan">
        Nilai baru dipakai di slip gaji ABK yang RHPP-nya sudah keluar, termasuk slip yang sudah dibuat sebelumnya, kecuali ABK yang uang makannya diambil dari kas operasional.
    </x-konfirmasi>

    <x-memuat target="simpan" teks="Menyimpan uang makan" />
</div>
