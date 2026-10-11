<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Laporan biaya operasional {{ $kandang->nama }}" :jejak="['Keuangan', 'Kas operasional', $kandang->nama]">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="kas.operasional" :parameter="['kandang' => $kandang->id]" />
        </x-breadcrumb>

        @if ($this->periodeKandang)
            <div class="col-lg-12 mb-25">
                <form wire:submit="simpan" class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <h6>{{ $transaksiId ? 'Ubah transaksi kas' : 'Tambah transaksi kas' }}</h6>
                        @if (! $this->bolehCatatPengeluaran)
                            <span class="card-extra fs-14 color-gray tanpa-kapital">Masukkan dana operasional terlebih dahulu</span>
                        @endif
                    </div>
                    <div class="card-body px-0">
                        @if ($pesan)
                            <div class="alert alert-success mb-25" role="status">
                                <div class="alert-content"><p>{{ $pesan }}</p></div>
                            </div>
                        @endif

                        @error('transaksi_hapus')
                            <div class="alert alert-danger mb-25" role="alert">
                                <div class="alert-content"><p>{{ $message }}</p></div>
                            </div>
                        @enderror

                        @if (! $this->bolehCatatPengeluaran)
                            <div class="alert alert-info mb-25" role="status">
                                <div class="alert-content">
                                    <h6 class="alert-heading">Dana operasional belum tersedia</h6>
                                    <p>Catat dana operasional terlebih dahulu. Setelah setoran tersimpan, kategori pengeluaran akan tersedia.</p>
                                </div>
                            </div>
                        @endif

                        <div class="row">
                            <div class="col-md-3 form-group mb-20">
                                <label for="kas-tanggal" class="il-gray fs-14 fw-500 mb-10">Tanggal</label>
                                <input id="kas-tanggal" type="date" wire:model="tanggal" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('tanggal')])>
                                @error('tanggal')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                            <div class="col-md-3 form-group mb-20">
                                <label for="kas-kategori" class="il-gray fs-14 fw-500 mb-10">Kategori</label>
                                <select id="kas-kategori" wire:model="kategoriTransaksi" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('kategoriTransaksi')])>
                                    @foreach (\App\Enums\KategoriKas::cases() as $pilihan)
                                        @if ($pilihan->masuk() || $this->bolehCatatPengeluaran)
                                            <option value="{{ $pilihan->value }}">{{ $pilihan->label() }}</option>
                                        @endif
                                    @endforeach
                                </select>
                                @error('kategoriTransaksi')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                            <div class="col-md-3 form-group mb-20">
                                <label for="kas-jumlah" class="il-gray fs-14 fw-500 mb-10">Jumlah (Rp)</label>
                                <input id="kas-jumlah" type="number" min="1" step="1" wire:model="jumlah" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('jumlah')])>
                                @error('jumlah')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                            <div class="col-md-3 form-group mb-20">
                                <label for="kas-uraian" class="il-gray fs-14 fw-500 mb-10">Uraian</label>
                                <input id="kas-uraian" type="text" maxlength="255" wire:model="uraian" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('uraian')])>
                                @error('uraian')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                        </div>

                        <div class="d-flex flex-wrap align-items-center gap-3">
                            @if ($transaksiId)
                                <button type="button" class="btn btn-primary btn-default btn-squared radius-md shadow2 btn-sm" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-transaksi-kas" wire:loading.attr="disabled" wire:target="simpan, hapus">Simpan perubahan</button>
                                <button type="button" class="btn btn-light btn-default btn-squared fw-400 text-capitalize radius-md btn-sm" wire:click="batalUbah">Batal ubah</button>
                            @else
                                <button type="submit" class="btn btn-primary btn-default btn-squared radius-md shadow2 btn-sm" wire:loading.attr="disabled" wire:target="simpan">Simpan transaksi</button>
                            @endif

                            @if ($errors->any() && ! $errors->has('transaksi_hapus'))
                                <span class="color-danger fs-14" role="alert">Periksa kembali isian yang ditandai.</span>
                            @endif
                        </div>
                    </div>
                </form>
            </div>
        @endif

        @if ($this->buku)
            {{-- Identitas laporan --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body">
                        <dl class="recording-info mb-0">
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Periode</dt><dd>{{ $this->periode->nama }}</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $kandang->nama }}</dd></div>
                            <div><dt>DOC masuk</dt><dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd></div>
                            <div><dt>Masa transaksi</dt><dd>{{ $this->buku['mulai']->translatedFormat('j F') }} s/d {{ $this->buku['selesai']->translatedFormat('j F Y') }}</dd></div>
                            <div><dt>Transaksi</dt><dd>@angka($this->buku['ringkasan']['jumlah_masuk']) dana masuk, @angka($this->buku['ringkasan']['jumlah_keluar']) pengeluaran</dd></div>
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
                        <p class="color-gray mb-0">{{ $this->periode->nama }} tidak mencatat chick-in di {{ $kandang->nama }}, jadi tidak ada kas operasionalnya. Pilih periode lain di kanan atas.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada transaksi kas</h5>
                        <p class="color-gray mb-0">Buku kas {{ $kandang->nama }} untuk {{ $this->periode->nama }} masih kosong. Mulai dengan mencatat dana operasional; setelah itu, pengeluaran dapat dicatat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="pilihKategori" teks="Memuat buku kas" cepat />
    <x-memuat target="simpan" teks="Menyimpan transaksi kas" />
    <x-memuat target="hapus" teks="Menghapus transaksi kas" />

    @if ($this->periodeKandang)
        @if ($transaksiId)
            <x-konfirmasi id="konfirmasi-simpan-transaksi-kas" judul="Simpan perubahan transaksi kas?" aksi="simpan" tombol="Ya, simpan perubahan">
                Tanggal, kategori, uraian, atau jumlah transaksi ini akan diperbarui.
            </x-konfirmasi>
        @endif

        <x-konfirmasi id="konfirmasi-hapus-transaksi-kas" judul="Hapus transaksi kas?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
            Transaksi ini dihapus permanen. Dana operasional terakhir tidak dapat dihapus selama masih ada pengeluaran.
        </x-konfirmasi>
    @endif
</div>
