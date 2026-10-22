<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Laporan biaya operasional {{ $kandang->nama }}" :jejak="['Keuangan', 'Kas operasional', $kandang->nama]">
            @if ($this->periodeKandang)
                <x-tombol ukuran="sm" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-kas" :disabled="$this->periode->tertutup()" wire:loading.attr="disabled" wire:target="tambah">
                    Tambah transaksi
                </x-tombol>
            @endif
        </x-breadcrumb>
        <x-periode-tertutup :periode="$this->periode" />

        @if ($this->periodeKandang)
        <div class="col-lg-12 mb-25">
            @if ($pesan)
            <x-peringatan warna="success" bisaDitutup="true" class="mb-0">
                {{ $pesan }}
            </x-peringatan>
            @endif

            @error('transaksi_hapus')
            <x-peringatan warna="danger" bisaDitutup="true" class="mb-0">
                {{ $message }}
            </x-peringatan>
            @enderror
        </div>
        @endif

        @if ($this->buku)
        {{-- Identitas laporan --}}
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body">
                    <dl class="recording-info mb-0">
                        <div>
                            <dt>Farm</dt>
                            <dd>Misjiwati / K0242</dd>
                        </div>
                        <div>
                            <dt>Kandang</dt>
                            <dd>{{ $kandang->nama }}</dd>
                        </div>
                        <div>
                            <dt>DOC masuk</dt>
                            <dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd>
                        </div>
                        <div>
                            <dt>Masa transaksi</dt>
                            <dd>{{ $this->buku['mulai']->translatedFormat('j F') }} s/d {{ $this->buku['selesai']->translatedFormat('j F Y') }}</dd>
                        </div>
                        <div>
                            <dt>Transaksi</dt>
                            <dd>@angka($this->buku['ringkasan']['jumlah_masuk']) dana masuk, @angka($this->buku['ringkasan']['jumlah_keluar']) pengeluaran</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>

        {{-- Angka utama --}}
        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['masuk'])" label="Dana operasional masuk" ikon="uil-arrow-circle-down" warna="primary">
            <small>Rp @angka($this->buku['ringkasan']['masuk']) dari @angka($this->buku['ringkasan']['jumlah_masuk']) kali setoran</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['keluar'])" label="Dana operasional keluar" ikon="uil-arrow-circle-up" warna="warning">
            <small>Rp @angka($this->buku['ringkasan']['keluar']) dari @angka($this->buku['ringkasan']['jumlah_keluar']) transaksi</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['selisih'])" label="Selisih dana" ikon="uil-balance-scale" :warna="$this->buku['ringkasan']['selisih'] < 0 ? 'danger' : 'success'">
            @if ($this->buku['ringkasan']['selisih'] < 0)
                <small>kurang Rp @angka(abs($this->buku['ringkasan']['selisih']))</small>
                @else
                <small>sisa Rp @angka($this->buku['ringkasan']['selisih'])</small>
                @endif
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->buku['ringkasan']['biaya'])" label="Total biaya operasional" ikon="uil-receipt" warna="info">
            <small>Rp @angka($this->buku['ringkasan']['biaya']) tanpa pinjaman</small>
        </x-dashboard.kartu>

        {{-- Kiri: dana masuk dan dua perhitungan. Kanan: pengeluaran per kategori. --}}
        <div class="col-xxl-5">
            <div class="row h-100">
                <x-kas.dana :dana="$this->buku['dana']" :total="$this->buku['ringkasan']['masuk']" />

                <x-rhpp.rincian judul="Selisih dana" lebar="col-xxl-12 col-lg-6 rincian-kas">
                    <x-rhpp.baris label="Dana operasional masuk" :angka="$this->buku['ringkasan']['masuk']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_masuk']).' kali setoran'" />
                    <x-rhpp.baris label="Dana operasional keluar" :angka="$this->buku['ringkasan']['keluar']" :satuan="\App\Support\Format::angka($this->buku['ringkasan']['jumlah_keluar']).' transaksi'" />
                    <x-rhpp.baris label="Selisih dana (masuk − keluar)" :angka="$this->buku['ringkasan']['selisih']" :satuan="$this->buku['ringkasan']['selisih'] < 0 ? 'dana kurang' : 'dana tersisa'" kurung sorot />
                    <x-slot:catatan>Angka dalam kurung berarti pengeluaran melebihi dana yang masuk.</x-slot:catatan>
                </x-rhpp.rincian>

                <x-rhpp.rincian judul="Total biaya operasional" lebar="col-xxl-12 col-lg-6 rincian-kas">
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

        <x-kas.buku :tersaring="$this->tersaring" :saringan="$this->saringan" :pilihan="$this->pilihanKategori" :ringkasan="$this->buku['ringkasan']" />
        @elseif (! $this->periode)
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <h5 class="mb-10">Belum ada periode</h5>
                    <p class="color-gray mb-0">Kas operasional dicatat per kandang dalam satu periode. Halaman ini terisi setelah periode pertama dibuat.</p>
                </div>
            </div>
        </div>
        @elseif (! $this->periodeKandang)
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <h5 class="mb-10">{{ $kandang->nama }} tidak dipakai di periode ini</h5>
                    <p class="color-gray mb-0">Periode terpilih tidak mencatat chick-in di {{ $kandang->nama }}, jadi tidak ada kas operasionalnya. Anda dapat memilih periode lain dari bar atas.</p>
                </div>
            </div>
        </div>
        @else
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <h5 class="mb-10">Belum ada transaksi kas</h5>
                    <p class="color-gray mb-0">Buku kas {{ $kandang->nama }} pada periode terpilih masih kosong. Mulai dengan mencatat dana operasional; setelah itu, pengeluaran dapat dicatat.</p>
                </div>
            </div>
        </div>
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
                    <x-peringatan warna="info" class="mb-25">
                        Catat dana operasional terlebih dahulu. Setelah setoran tersimpan, kategori pengeluaran akan tersedia.
                    </x-peringatan>
                @endif

                <div class="row">
                    <div class="col-md-6">
                        <x-masukan
                            id="kas-tanggal"
                            label="Tanggal"
                            tipe="date"
                            wire:model="tanggal"
                            :disabled="$this->periode->tertutup()"
                            :kesalahan="$errors->first('tanggal')" />
                    </div>
                    <div class="col-md-6 mb-25">
                        <label for="kas-kategori" class="il-gray fs-14 fw-500 mb-10">Kategori</label>
                        <select id="kas-kategori" wire:model="kategoriTransaksi" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('kategoriTransaksi')]) @disabled($this->periode->tertutup())>
                            @foreach (\App\Enums\KategoriKas::cases() as $pilihan)
                                @if ($pilihan->masuk() || $this->bolehCatatPengeluaran)
                                    <option value="{{ $pilihan->value }}">{{ $pilihan->label() }}</option>
                                @endif
                            @endforeach
                        </select>
                        @error('kategoriTransaksi')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                    <div class="col-md-6">
                        <x-masukan
                            id="kas-jumlah"
                            label="Jumlah (Rp)"
                            tipe="number"
                            min="1"
                            step="1"
                            wire:model="jumlah"
                            :disabled="$this->periode->tertutup()"
                            :kesalahan="$errors->first('jumlah')" />
                    </div>
                    <div class="col-md-6">
                        <x-masukan
                            id="kas-uraian"
                            label="Uraian"
                            maxlength="255"
                            wire:model="uraian"
                            :disabled="$this->periode->tertutup()"
                            :kesalahan="$errors->first('uraian')" />
                    </div>
                </div>

                <x-slot:footer>
                    <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="batalUbah">
                        Batal
                    </x-tombol>
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