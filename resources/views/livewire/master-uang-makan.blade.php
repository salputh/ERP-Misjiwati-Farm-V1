<div class="col-12 mb-4">
    <x-kartu judul="Uang makan" subjudul="Dipotong dari slip gaji setiap ABK setelah RHPP periode itu keluar. Jabatan lain tidak dipotong.">
        <x-slot:ekstra>
            <x-tombol wire:click="ubah" data-bs-toggle="modal" data-bs-target="#modal-uang-makan">Ubah uang makan</x-tombol>
        </x-slot:ekstra>

        @if ($pesan)
            <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
        @endif

        {{-- Statistik template  --}}
        <div class="d-flex flex-wrap">
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Per orang per hari</span>
                <p class="h5 mb-0">Rp @angka($this->uangMakan['per_hari'])</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Jumlah hari</span>
                <p class="h5 mb-0">@angka($this->uangMakan['hari']) hari</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Dipotong per ABK</span>
                <p class="h5 mb-0">Rp @angka($this->uangMakan['total'])</p>
            </div>
        </div>

        <p class="small text-body-secondary mt-3 mb-0">
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
