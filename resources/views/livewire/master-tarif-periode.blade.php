<div class="col-12 mb-25">
    <x-kartu judul="Tarif periode" subjudul="Tarif bagi hasil yang sama untuk setiap periode. Menjadi asumsi simulasi bagi hasil di RHPP selama kandang belum punya lembar bagi hasil sendiri.">
        <x-slot:ekstra>
            <x-tombol wire:click="ubah" data-bs-toggle="modal" data-bs-target="#modal-tarif-periode">Ubah tarif periode</x-tombol>
        </x-slot:ekstra>

        @if ($pesan)
            <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
        @endif

        {{-- Statistik template (HexaDash: Statistics, Basic) --}}
        <div class="dm-statistics-wrap d-flex flex-wrap">
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Gaji ABK per kg</span>
                <p class="statistics-item__number">Rp @angka($this->tarifGlobal->tarif_gaji_abk_per_kg)</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Premi controller</span>
                <p class="statistics-item__number">Rp @angka($this->tarifGlobal->premi_controller)</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Upah controller</span>
                <p class="statistics-item__number">{{ \App\Support\Format::persen($this->tarifGlobal->persen_upah_controller) }}</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Bonus pasar ABK</span>
                <p class="statistics-item__number">{{ \App\Support\Format::persen($this->tarifGlobal->persen_bonus_pasar_abk) }}</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Bonus pasar controller</span>
                <p class="statistics-item__number">{{ \App\Support\Format::persen($this->tarifGlobal->persen_bonus_pasar_controller) }}</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Zakat</span>
                <p class="statistics-item__number">{{ \App\Support\Format::persen($this->tarifGlobal->persen_zakat) }}</p>
            </div>
        </div>
    </x-kartu>

    <x-modal
        id="modal-tarif-periode"
        ukuran="lg"
        judul="Ubah tarif periode"
        x-on:tutup-modal-tarif-periode.window="bootstrap.Modal.getInstance($el).hide()"
        submit="simpan">
        <h6 class="fs-14 fw-500 mb-15">Anak kandang dan controller</h6>
        <div class="row">
            <div class="col-md-6">
                <x-masukan id="tarif-gaji" label="Gaji ABK per kg (Rp)" tipe="number" min="0" step="1" wire:model="tarif.tarif_gaji_abk_per_kg" :kesalahan="$errors->first('tarif.tarif_gaji_abk_per_kg')" />
            </div>
            <div class="col-md-6">
                <x-masukan.ribuan properti="tarif.premi_controller" teks id="tarif-premi-controller" label="Premi controller (Rp)" :kesalahan="$errors->first('tarif.premi_controller')" />
            </div>
        </div>

        <h6 class="fs-14 fw-500 mb-15">Persentase</h6>
        <div class="row">
            <div class="col-md-6">
                <x-masukan id="tarif-upah-controller" label="Upah controller (% jumlah pendapatan)" tipe="number" min="0" max="100" step="0.01" wire:model="tarif.persen_upah_controller" :kesalahan="$errors->first('tarif.persen_upah_controller')" />
            </div>
            <div class="col-md-6">
                <x-masukan id="tarif-zakat" label="Zakat (% sisa setelah entertain)" tipe="number" min="0" max="100" step="0.01" wire:model="tarif.persen_zakat" :kesalahan="$errors->first('tarif.persen_zakat')" />
            </div>
            <div class="col-md-6">
                <x-masukan id="tarif-bonus-abk" label="Bonus pasar ABK (% bonus pasar)" tipe="number" min="0" max="100" step="0.01" wire:model="tarif.persen_bonus_pasar_abk" :kesalahan="$errors->first('tarif.persen_bonus_pasar_abk')" />
            </div>
            <div class="col-md-6">
                <x-masukan id="tarif-bonus-controller" label="Bonus pasar controller (% bonus pasar)" tipe="number" min="0" max="100" step="0.01" wire:model="tarif.persen_bonus_pasar_controller" :kesalahan="$errors->first('tarif.persen_bonus_pasar_controller')" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            <x-tombol data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-tarif-periode" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-konfirmasi id="konfirmasi-simpan-tarif-periode" judul="Simpan perubahan tarif periode?" aksi="simpan" tombol="Ya, simpan perubahan">
        Tarif ini berlaku untuk simulasi bagi hasil setiap periode. Lembar bagi hasil yang sudah tersimpan tidak ikut berubah.
    </x-konfirmasi>

    <x-memuat target="simpan" teks="Menyimpan tarif periode" />
</div>
