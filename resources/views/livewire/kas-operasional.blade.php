<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Laporan biaya operasional {{ $kandang->nama }}" :jejak="['Keuangan', 'Kas operasional', $kandang->nama]" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif
        @error('transaksi_hapus')
            <div class="col-12">
                <x-peringatan warna="danger" bisaDitutup="true" class="mb-4">{{ $message }}</x-peringatan>
            </div>
        @enderror

        @if ($this->buku)
        {{-- Identitas laporan --}}
        <div class="col-12 mb-4">
            <section class="card basalt-box db-card">
<div class="db-card-body">
                    <x-info class="mb-0">
                        <x-info.butir label="Farm">Misjiwati / K0242</x-info.butir>
                        <x-info.butir label="Kandang">{{ $kandang->nama }}</x-info.butir>
                        <x-info.butir label="DOC masuk">{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</x-info.butir>
                        <x-info.butir label="Masa transaksi">{{ $this->buku['mulai']->translatedFormat('j F') }} s/d {{ $this->buku['selesai']->translatedFormat('j F Y') }}</x-info.butir>
                        <x-info.butir label="Transaksi">@angka($this->buku['ringkasan']['jumlah_masuk']) dana masuk, @angka($this->buku['ringkasan']['jumlah_keluar']) pengeluaran</x-info.butir>
                    </x-info>
                
</div>
</section>
        </div>

        {{-- Angka utama --}}
        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['masuk'])" label="Dana operasional masuk" ikon="bi-arrow-down-circle" warna="primary">
            <small>Rp @angka($this->buku['ringkasan']['masuk']) dari @angka($this->buku['ringkasan']['jumlah_masuk']) kali setoran</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['keluar'])" label="Dana operasional keluar" ikon="bi-arrow-up-circle" warna="warning">
            <small>Rp @angka($this->buku['ringkasan']['keluar']) dari @angka($this->buku['ringkasan']['jumlah_keluar']) transaksi</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['selisih'])" label="Selisih dana" ikon="bi-calculator" :warna="$this->buku['ringkasan']['selisih'] < 0 ? 'danger' : 'success'">
            @if ($this->buku['ringkasan']['selisih'] < 0)
                <small>kurang Rp @angka(abs($this->buku['ringkasan']['selisih']))</small>
                @else
                <small>sisa Rp @angka($this->buku['ringkasan']['selisih'])</small>
                @endif
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['biaya'])" label="Total biaya operasional" ikon="bi-receipt-cutoff" warna="info">
            <small>Rp @angka($this->buku['ringkasan']['biaya']) tanpa pinjaman</small>
        </x-dashboard.kartu>

        {{-- Kiri: dana masuk dan dua perhitungan. Kanan: pengeluaran per kategori. --}}
        <div class="col-xxl-5">
            <div class="row h-100">
                <x-kas.dana :dana="$this->buku['dana']" :total="$this->buku['ringkasan']['masuk']" />

                <x-rhpp.rincian judul="Selisih dana" lebar="col-xxl-12 col-lg-6">
                    <x-rhpp.baris label="Dana operasional masuk" :angka="$this->buku['ringkasan']['masuk']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_masuk']).' kali setoran'" />
                    <x-rhpp.baris label="Dana operasional keluar" :angka="$this->buku['ringkasan']['keluar']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_keluar']).' transaksi'" />
                    <x-rhpp.baris label="Selisih dana (masuk − keluar)" :angka="$this->buku['ringkasan']['selisih']" :satuan="$this->buku['ringkasan']['selisih'] < 0 ? 'dana kurang' : 'dana tersisa'" kurung sorot />
                    <x-slot:catatan>Angka dalam kurung berarti pengeluaran melebihi dana yang masuk.</x-slot:catatan>
                </x-rhpp.rincian>

                <x-rhpp.rincian judul="Total biaya operasional" lebar="col-xxl-12 col-lg-6">
                    <x-rhpp.baris label="Dana operasional keluar" :angka="$this->buku['ringkasan']['keluar']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_keluar']).' transaksi'" />
                    @foreach ($this->buku['pinjaman'] as $pinjaman)
                    <x-rhpp.baris label="Dikurangi {{ $pinjaman['kategori']->label() }}" :angka="$pinjaman['jumlah']" :satuan="\App\Support\Format::angka($pinjaman['transaksi']).' transaksi'" />
                    @endforeach
                    <x-rhpp.baris label="Total biaya operasional" :angka="$this->buku['ringkasan']['biaya']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_biaya']).' transaksi'" sorot />
                    <x-slot:catatan>Pinjaman karyawan keluar dari kas, tetapi tidak dihitung sebagai biaya operasional kandang.</x-slot:catatan>
                </x-rhpp.rincian>
            </div>
        </div>

        <x-kas.kategori :biaya="$this->buku['biaya']" :pinjaman="$this->buku['pinjaman']" :ringkasan="$this->buku['ringkasan']" />

        <x-kas.buku :tersaring="$this->tersaring" :saringan="$this->saringan" :pilihan="$this->pilihanKategori" :ringkasan="$this->buku['ringkasan']" :tombol-tambah="$this->periodeKandang" :periode-tertutup="$this->periode->tertutup()" />
        @elseif (! $this->periode)
        <x-kosong judul="Belum ada periode">Kas operasional dicatat per kandang dalam satu periode. Halaman ini terisi setelah periode pertama dibuat.</x-kosong>
        @elseif (! $this->periodeKandang)
        <x-kosong judul="{{ $kandang->nama }} tidak dipakai di periode ini">Periode terpilih tidak mencatat chick-in di {{ $kandang->nama }}, jadi tidak ada kas operasionalnya. Anda dapat memilih periode lain dari bar atas.</x-kosong>
        @else
        <x-kosong judul="Belum ada transaksi kas">Buku kas {{ $kandang->nama }} pada periode terpilih masih kosong. Mulai dengan mencatat dana operasional; setelah itu, pengeluaran dapat dicatat.</x-kosong>
        @endif
    </div>

    <x-memuat target="pilihKategori" teks="Memuat buku kas" cepat />
    <x-memuat target="simpan" teks="Menyimpan transaksi kas" />
    <x-memuat target="hapus" teks="Menghapus transaksi kas" />

    @if ($this->periodeKandang)
        <x-modal
            id="modal-form-kas"
            :judul="$transaksiId ? 'Ubah transaksi kas' : 'Tambah transaksi kas'"
            ukuran="lg"
            x-on:tutup-modal-kas.window="bootstrap.Modal.getInstance($el).hide()"
            submit="simpan"
        >
                @if (! $this->bolehCatatPengeluaran)
                    <x-peringatan warna="info">
                        Catat dana operasional terlebih dahulu. Setelah setoran tersimpan, kategori pengeluaran akan tersedia.
                    </x-peringatan>
                @endif

                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3 mb-4">
                            <label for="kas-tanggal" class="form-label fw-medium mb-2">Tanggal</label>
                            <x-pilih-tanggal id="kas-tanggal" ukuran="medium" :nilai="$tanggal" :nonaktif="$this->periode->tertutup()" :kesalahan="$errors->has('tanggal')" x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)" />
                            @error('tanggal')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3 mb-4">
                            <label class="form-label fw-medium mb-2">Kategori</label>
                            <x-pilih bentuk="isian" nama="Kategori transaksi" :label="$isiKategoriBaru ? '+ Kategori baru' : ($this->kategoriTerpilih?->label() ?? 'Pilih kategori')" :kesalahan="$errors->has('kategoriTransaksi')" :nonaktif="$this->periode->tertutup()">
                                @foreach (\App\Enums\KategoriKas::cases() as $pilihan)
                                    @if ($pilihan->masuk() || $this->bolehCatatPengeluaran)
                                        <button type="button" wire:click="pakaiKategori(@js($pilihan->value))" @class(['dropdown-item', 'active' => ! $isiKategoriBaru && $kategoriTransaksi === $pilihan->value])>{{ $pilihan->label() }}</button>
                                    @endif
                                @endforeach
                                @if ($this->bolehCatatPengeluaran)
                                    @foreach ($this->kategoriTambahan as $pilihan)
                                        <button type="button" wire:click="pakaiKategori(@js($pilihan->value))" wire:key="kategori-tambahan-{{ $loop->index }}" @class(['dropdown-item', 'active' => ! $isiKategoriBaru && $kategoriTransaksi === $pilihan->value])>{{ $pilihan->label() }}</button>
                                    @endforeach
                                    <div class="dropdown-divider"></div>
                                    <button type="button" wire:click="pakaiKategori(null)" @class(['dropdown-item', 'active' => $isiKategoriBaru])>+ Kategori baru</button>
                                @endif
                            </x-pilih>
                            @error('kategoriTransaksi')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                    </div>
                    @if ($isiKategoriBaru)
                        <div class="col-12">
                            <x-masukan
                                id="kas-kategori-baru"
                                label="Nama kategori baru"
                                maxlength="50"
                                placeholder="Contoh: Pupuk, Sekam, Air bersih"
                                keterangan="Dihitung sebagai biaya operasional dan dapat dipilih lagi dari daftar kategori setelah tersimpan."
                                wire:model="namaKategoriBaru"
                                :disabled="$this->periode->tertutup()"
                                :kesalahan="$errors->first('namaKategoriBaru')" />
                        </div>
                    @endif
                    <div class="col-md-6">
                        <x-masukan.ribuan properti="jumlah" teks
                            id="kas-jumlah"
                            label="Jumlah (Rp)"
                           
                           
                           
                           
                            :disabled="$this->periode->tertutup()"
                            :kesalahan="$errors->first('jumlah')" />
                    </div>
                    <div class="col-md-6">
                        <x-masukan
                            id="kas-uraian"
                            label="Uraian"
                            maxlength="255"
                            :keterangan="$kategoriTransaksi === \App\Enums\KategoriKas::PinjamanMakan->value && ! $isiKategoriBaru ? 'Tulis nama ABK, mis. “Uang makan Frengky”, supaya terpotong di slip gajinya.' : null"
                            :placeholder="$kategoriTransaksi === \App\Enums\KategoriKas::PinjamanMakan->value && ! $isiKategoriBaru ? 'Contoh: Uang makan Frengky' : null"
                            wire:model="uraian"
                            :disabled="$this->periode->tertutup()"
                            :kesalahan="$errors->first('uraian')" />
                    </div>
                </div>

                <x-slot:footer>
                    <x-tombol.batal wire:click="batalUbah" />
                    @if ($transaksiId)
                        <x-tombol tipe="button" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-transaksi-kas" :disabled="$this->periode->tertutup()" wire:loading.attr="disabled" wire:target="simpan, hapus">
                            Simpan perubahan
                        </x-tombol>
                    @else
                        <x-tombol tipe="submit" :disabled="$this->periode->tertutup()" wire:loading.attr="disabled" wire:target="simpan">
                            Simpan transaksi
                        </x-tombol>
                    @endif
                </x-slot:footer>
        </x-modal>

        @if ($transaksiId)
    <x-konfirmasi id="konfirmasi-simpan-transaksi-kas" judul="Simpan perubahan transaksi kas?" aksi="simpan" tombol="Ya, simpan perubahan">
        Tanggal, kategori, uraian, atau jumlah transaksi ini akan diperbarui.
    </x-konfirmasi>
    @endif

    <x-konfirmasi id="konfirmasi-hapus-transaksi-kas" judul="Hapus transaksi kas?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
        Transaksi ini dihapus permanen. Dana operasional terakhir tidak dapat dihapus selama masih ada pengeluaran.
    </x-konfirmasi>
    @endif
</div>