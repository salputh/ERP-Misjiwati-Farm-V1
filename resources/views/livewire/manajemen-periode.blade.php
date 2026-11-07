<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Periode dan kandang" :jejak="['Periode', 'Periode dan kandang']">
            <x-tombol.kepala warna="white" ikon="bi bi-plus-lg" wire:click="tambahFarm" data-bs-toggle="modal" data-bs-target="#modal-farm">Tambah farm</x-tombol.kepala>
            <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambahPeriode" data-bs-toggle="modal" data-bs-target="#modal-periode" wire:loading.attr="disabled" wire:target="tambahPeriode, simpanPeriode">Buat periode</x-tombol.kepala>
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        <div class="col-xxl-3 col-lg-4">
            <x-periode.daftar :daftar="$this->daftarPeriode" :terpilih="$this->periodeTerpilih" :farm="$this->farmTerpilih" />
            <x-periode.kandang-farm :daftar="$this->daftarKandang" />
            @if ($this->periodeTerpilih)
                <x-periode.gabungan :periode="$this->periodeTerpilih" :gabungan="$this->ringkasanGabungan" />
            @endif
        </div>

        <div class="col-xxl-9 col-lg-8">
            @if ($this->periodeTerpilih)
                <x-periode.ringkasan :periode="$this->periodeTerpilih" />
                <x-periode.kandang :periode="$this->periodeTerpilih" />
                <div class="mb-4">
                    <x-periode.master :periode="$this->periodeTerpilih" :master-data="$this->masterData" />
                </div>
            @else
                <div class="row">
                    <x-kosong judul="Mulai dengan membuat periode">
                        Periode menjadi akar data chick-in, standar DOC, dan kandang. Semua pencatatan produksi serta keuangan selanjutnya mengikuti periode dan kandangnya.
                        <x-slot:aksi>
                            <x-tombol wire:click="tambahPeriode" data-bs-toggle="modal" data-bs-target="#modal-periode">Buat periode pertama</x-tombol>
                        </x-slot:aksi>
                    </x-kosong>
                </div>
            @endif
        </div>
    </div>

    <x-modal
        id="modal-farm"
        judul="Tambah farm"
        x-on:tutup-modal-farm.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanFarm">
            <div class="row">
                <div class="col-md-8">
                    <x-masukan id="farm-nama" label="Nama farm" maxlength="150" wire:model="namaFarm" :kesalahan="$errors->first('namaFarm')" placeholder="Contoh: Misjiwati Farm" />
                </div>
                <div class="col-md-4">
                    <x-masukan id="farm-kode" label="Kode farm (opsional)" maxlength="40" wire:model="kodeFarm" :kesalahan="$errors->first('kodeFarm')" placeholder="Contoh: K0242" />
                </div>
            </div>
            <x-slot:footer>
            <x-tombol.batal wire:click="tambahFarm" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanFarm">Simpan farm</x-tombol>
        </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-periode"
        :judul="$periodeFormId ? 'Ubah periode' : 'Buat periode'"
        x-on:tutup-modal-periode.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanPeriode">
            <p class="text-body-secondary mb-3">{{ $this->farmTerpilih?->nama }}</p>
            <div class="row">
                <div class="col-md-6">
                    <x-masukan id="periode-nama" label="Nama periode" maxlength="150" wire:model="nama" :kesalahan="$errors->first('nama')" placeholder="Contoh: Periode Oktober 2026" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-inti" label="Inti" maxlength="150" wire:model="inti" :kesalahan="$errors->first('inti')" placeholder="Contoh: PT. Indojaya Agrinusa" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-ppl" label="PPL" maxlength="150" wire:model="ppl" :kesalahan="$errors->first('ppl')" placeholder="Nama PPL" />
                </div>
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">Standar strain</label>
                        <x-pilih bentuk="isian" nama="Standar strain" :label="$strain ?: 'Pilih standar strain'" :kesalahan="$errors->has('strain')">
                            @foreach (array_keys(config('standar.strain', [])) as $strainPilihan)
                                <button type="button" wire:click="$set('strain', '{{ $strainPilihan }}')" @class(['dropdown-item', 'active' => $strain === $strainPilihan])>{{ $strainPilihan }}</button>
                            @endforeach
                        </x-pilih>
                        @error('strain')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">Status</label>
                        <x-pilih bentuk="isian" nama="Status periode" :label="['persiapan' => 'Persiapan', 'berjalan' => 'Berjalan', 'panen' => 'Panen', 'tutup_rhpp' => 'Tutup RHPP'][$status] ?? 'Pilih status'" :kesalahan="$errors->has('status')">
                            @foreach (['persiapan' => 'Persiapan', 'berjalan' => 'Berjalan', 'panen' => 'Panen', 'tutup_rhpp' => 'Tutup RHPP'] as $nilaiStatus => $labelStatus)
                                <button type="button" wire:click="$set('status', '{{ $nilaiStatus }}')" @class(['dropdown-item', 'active' => $status === $nilaiStatus])>{{ $labelStatus }}</button>
                            @endforeach
                        </x-pilih>
                        @error('status')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label for="periode-chick-in" class="form-label fw-medium mb-2">Tanggal chick-in</label>
                        <x-pilih-tanggal id="periode-chick-in" ukuran="medium" :nilai="$tanggalChickIn" :kesalahan="$errors->has('tanggalChickIn')" x-on:tanggal-dipilih="$wire.set('tanggalChickIn', $event.detail)" />
                        @error('tanggalChickIn')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-berat-doc" label="Berat DOC (gram)" tipe="number" min="1" max="1000" step="1" wire:model="beratDocGram" :kesalahan="$errors->first('beratDocGram')" />
                </div>
                @unless ($periodeFormId)
                    <div class="col-12">
                        <p class="form-label fw-medium mb-1">Nomor siklus dan populasi tiap kandang</p>
                        <p class="small text-body-secondary mb-3">Nomor siklus berbeda untuk tiap kandang dan dicatat terpisah. RHPP menggabungkan semuanya. Kosongkan populasi kandang yang tidak dipakai pada periode ini.</p>
                        <div class="row g-3">
                            @foreach ($this->daftarKandang as $kandang)
                                <div class="col-12"><p class="fw-medium small mb-0">{{ $kandang->nama }}</p></div>
                                <div class="col-md-6">
                                    <x-masukan id="periode-siklus-{{ $kandang->id }}" label="Nomor siklus" tipe="number" min="1" max="65535" step="1" wire:model="siklusKandang.{{ $kandang->id }}" :kesalahan="$errors->first('siklusKandang.'.$kandang->id)" />
                                </div>
                                <div class="col-md-6">
                                    <x-masukan id="periode-populasi-{{ $kandang->id }}" label="Populasi awal (ekor)" tipe="number" min="1" :max="$kandang->kapasitas" step="1" wire:model="populasiKandang.{{ $kandang->id }}" :kesalahan="$errors->first('populasiKandang.'.$kandang->id)" :keterangan="'Kapasitas '.\App\Support\Format::angka($kandang->kapasitas).' ekor'" />
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endunless
                @if ($periodeFormId && $this->periodeTerpilih?->kandangPeriode->isNotEmpty())
                    <div class="col-md-6">
                        <x-masukan.ribuan properti="jumlahDocChickIn" teks
                            id="periode-jumlah-doc"
                            label="Jumlah DOC chick-in (ekor)"
                            :kesalahan="$errors->first('jumlahDocChickIn')"
                            keterangan="Total DOC yang masuk pada periode ini. Bila diubah, populasi tiap kandang dibagi ulang sesuai porsinya." />
                    </div>
                @endif
                @error('periodeForm')
                    <div class="col-12"><x-peringatan warna="danger">{{ $message }}</x-peringatan></div>
                @enderror
            </div>
            <x-slot:footer>
            <x-tombol.batal wire:click="batalPeriode" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanPeriode">Simpan periode</x-tombol>
        </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-kandang-master"
        :judul="$kandangMasterFormId ? 'Ubah kandang farm' : 'Tambah kandang farm'"
        x-on:tutup-modal-kandang-master.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanKandangMaster">
            <p class="text-body-secondary mb-3">Kandang induk di farm ini. Kapasitas menjadi batas populasi DOC pada periode yang memakai kandang tersebut.</p>
            <div class="row">
                <div class="col-md-7">
                    <x-masukan id="kandang-master-nama" label="Nama kandang" maxlength="150" wire:model="kandangMasterNama" :kesalahan="$errors->first('kandangMasterNama')" placeholder="Contoh: Kandang 3" />
                </div>
                <div class="col-md-5">
                    <x-masukan.ribuan properti="kandangMasterKapasitas" teks id="kandang-master-kapasitas" label="Kapasitas (ekor)" :kesalahan="$errors->first('kandangMasterKapasitas')" placeholder="Contoh: 20.000" />
                </div>
            </div>
            <x-slot:footer>
            <x-tombol.batal wire:click="tambahKandangMaster" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanKandangMaster">Simpan kandang</x-tombol>
        </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-kandang-periode"
        :judul="$periodeKandangFormId ? 'Ubah kandang periode' : 'Tambah kandang ke periode'"
        x-on:tutup-modal-kandang-periode.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanKandang">
            @if ($periodeKandangFormId && $this->periodeTerpilih?->kandangPeriode->firstWhere('id', $periodeKandangFormId)?->punyaCatatan())
                <x-peringatan warna="warning" judul="Kandang sudah punya data produksi dan keuangan">Populasi awal, bonus DOC, dan harga DOC masih dapat disesuaikan. Kandang yang dipakai, tanggal chick-in, dan berat DOC terkunci karena sudah menjadi dasar perhitungan laporan.</x-peringatan>
            @endif
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">Kandang</label>
                        <x-pilih bentuk="isian" nama="Kandang" :label="$this->daftarKandang->firstWhere('id', (int) $kandangId)?->nama ?? 'Pilih kandang'" :kesalahan="$errors->has('kandangId')">
                            @foreach ($this->daftarKandang as $kandang)
                                @if (! $this->periodeTerpilih?->kandangPeriode->contains('kandang_id', $kandang->id) || $kandang->id === (int) $kandangId)
                                    <button type="button" wire:click="$set('kandangId', '{{ $kandang->id }}')" @class(['dropdown-item', 'active' => $kandang->id === (int) $kandangId])>{{ $kandang->nama }} · kapasitas @angka($kandang->kapasitas)</button>
                                @endif
                            @endforeach
                        </x-pilih>
                        @error('kandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-siklus" label="Nomor siklus" tipe="number" min="1" max="65535" step="1" wire:model="nomorSiklusKandang" :kesalahan="$errors->first('nomorSiklusKandang')" placeholder="Contoh: 18" />
                </div>
                <div class="col-md-6">
                    <x-masukan.ribuan properti="populasiAwal" teks id="kandang-periode-populasi" label="Populasi awal (ekor)" :kesalahan="$errors->first('populasiAwal')" placeholder="Contoh: 26.000" />
                </div>
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label for="kandang-periode-chick-in" class="form-label fw-medium mb-2">Tanggal chick-in</label>
                        <x-pilih-tanggal id="kandang-periode-chick-in" ukuran="medium" :nilai="$tanggalChickInKandang" :kesalahan="$errors->has('tanggalChickInKandang')" x-on:tanggal-dipilih="$wire.set('tanggalChickInKandang', $event.detail)" />
                        @error('tanggalChickInKandang')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-berat-doc" label="Berat DOC (gram)" tipe="number" min="1" max="1000" step="1" wire:model="beratDocGramKandang" :kesalahan="$errors->first('beratDocGramKandang')" />
                </div>
                <div class="col-md-6">
                    <x-masukan.ribuan properti="hargaDocPerEkor" teks id="kandang-periode-harga-doc" label="Harga DOC (Rp/ekor, opsional)" :kesalahan="$errors->first('hargaDocPerEkor')" />
                </div>
                <div class="col-md-6">
                    <x-masukan.ribuan properti="bonusDocEkor" teks id="kandang-periode-bonus-doc" label="Bonus DOC (ekor)" :kesalahan="$errors->first('bonusDocEkor')" />
                </div>
                @error('kandangForm')
                    <div class="col-12"><x-peringatan warna="danger">{{ $message }}</x-peringatan></div>
                @enderror
            </div>
            <x-slot:footer>
            <x-tombol.batal wire:click="batalKandang" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanKandang">Simpan kandang</x-tombol>
        </x-slot:footer>
        </x-modal>

    <x-konfirmasi id="konfirmasi-hapus-periode" judul="Hapus periode {{ $namaPeriodeHapus }}?" aksi="hapusPeriode" tombol="Ya, hapus" warna="danger" memuat="mintaHapusPeriode">
        Periode hanya dapat dihapus jika belum memiliki transaksi. Periode dengan data produksi atau keuangan harus diarsipkan dengan mengubah statusnya menjadi selesai.
        @error('hapusPeriode')<span class="d-block text-danger mt-2">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-kandang-master" judul="Hapus {{ $kandangMasterHapusNama }}?" aksi="hapusKandangMaster" tombol="Ya, hapus" warna="danger" memuat="mintaHapusKandangMaster">
        Kandang hanya dapat dihapus jika belum dipakai pada periode mana pun.
        @error('hapusKandangMaster')<span class="d-block text-danger mt-2">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-kandang-periode" judul="Lepas {{ $namaKandangHapus }} dari periode?" aksi="hapusKandang" tombol="Ya, lepas" warna="danger" memuat="mintaHapusKandang">
        Kandang hanya dapat dilepas jika belum memiliki catatan produksi atau keuangan.
        @error('hapusKandang')<span class="d-block text-danger mt-2">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-modal
        id="modal-buka-kunci-bagi-hasil"
        judul="Buka kunci bagi hasil"
        submit="bukaKunciBagiHasil"
        x-on:tutup-modal-buka-kunci-bagi-hasil.window="bootstrap.Modal.getInstance($el).hide()">
        <p class="text-body-secondary mb-3">Masukkan password admin untuk membuka kembali lembar bagi hasil yang dikunci.</p>
        <x-masukan id="buka-kunci-bagi-hasil-sandi" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
        <x-slot:footer>
            <x-tombol.batal />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="bukaKunciBagiHasil">Buka kunci</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-memuat target="simpanPeriode, simpanKandang, hapusPeriode, hapusKandang, simpanKandangMaster, hapusKandangMaster, bukaKunciBagiHasil" teks="Menyimpan data periode" />
</div>
