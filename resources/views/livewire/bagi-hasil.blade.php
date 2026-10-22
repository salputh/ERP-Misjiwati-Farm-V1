<div class="container-fluid">
    <div class="row" id="halaman-bagi-hasil">
        <x-breadcrumb judul="Bagi hasil {{ $kandang->nama }}" :jejak="['Keuangan', 'Bagi hasil', $kandang->nama]">
            @if ($this->periode && $this->lembar)
                <a
                    data-lewati-ekspor
                    class="btn btn-sm btn-outline-primary btn-squared"
                    href="{{ route('bagi.hasil.export.pdf', ['kandang' => $kandang->id, 'periode' => $this->periode->id]) }}">
                    <i class="uil uil-file-pdf"></i> Ekspor PDF
                </a>
                <button
                    type="button"
                    data-lewati-ekspor
                    class="btn btn-sm btn-primary btn-squared mx-3"
                    x-data="eksporHalaman('#halaman-bagi-hasil', @js($this->namaBerkasGambar))"
                    x-on:click="simpan()"
                    x-bind:disabled="sibuk"
                    x-text="sibuk ? 'Menyiapkan gambar...' : 'Ekspor PNG'">
                </button>
            @endif
        </x-breadcrumb>
        @if ($kandang->nama === 'Kandang 2')
            <x-periode-tertutup :periode="$this->periode" />
        @endif

        @if ($this->bagiHasilTerkunci)
            <div class="col-lg-12 mb-25">
                <x-peringatan warna="secondary" judul="Bagi hasil {{ $kandang->nama }} dikunci" class="mb-0">
                    Pengaturan bagi hasil tidak dapat diubah selama terkunci. Buka kuncinya dari halaman Periode bila perlu diperbaiki.
                </x-peringatan>
            </div>
        @endif

        @if ($pesan)
            <div class="col-lg-12 mb-25">
                <x-peringatan warna="success" bisaDitutup="true">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($kandang->nama === 'Kandang 2' && $this->periodeKandang?->bagiHasil && ! $this->periode?->tertutup() && ! $this->bagiHasilTerkunci)
            <div class="col-lg-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <h6>Pengaturan bagi hasil Kandang 2</h6>
                        <div class="card-extra fs-12 color-gray">Simpan perubahan untuk menghitung ulang pembagian.</div>
                    </div>
                    <div class="card-body px-0">
                        @error('pemodal')
                            <x-peringatan warna="danger" class="mb-20">{{ $message }}</x-peringatan>
                        @enderror
                        @error('abk')
                            <x-peringatan warna="danger" class="mb-20">{{ $message }}</x-peringatan>
                        @enderror

                        <form wire:submit="simpan">
                            <h6 class="mb-15">Pengeluaran dan tarif</h6>
                            <div class="row">
                                <div class="col-md-4">
                                    <x-masukan
                                        id="bagi-hasil-operasional"
                                        tipe="number"
                                        min="0"
                                        step="1"
                                        label="Operasional kandang (Rp)"
                                        readonly
                                        wire:model="masukan.operasional"
                                        keterangan="Dikunci: diambil otomatis dari total biaya operasional di halaman kas operasional, tidak termasuk pinjaman makan dan pinjaman karyawan." />
                                    <span class="fs-12 color-gray d-block mt-5">
                                        Sumber:
                                        <a href="{{ route('kas.operasional', ['kandang' => $kandang->id, 'periode' => $this->periode?->id]) }}">
                                            Kas operasional {{ $kandang->nama }}
                                        </a>
                                    </span>
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-tarif-abk" tipe="number" min="0" step="1" label="Tarif gaji ABK per kg (Rp)" wire:model="masukan.tarif_gaji_abk_per_kg" :kesalahan="$errors->first('masukan.tarif_gaji_abk_per_kg')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-premi-pemeliharaan" tipe="number" min="0" step="1" label="Premi pemeliharaan ABK (Rp)" wire:model="masukan.premi_pemeliharaan_abk" :kesalahan="$errors->first('masukan.premi_pemeliharaan_abk')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-controller" label="Nama controller" wire:model="masukan.controller" maxlength="150" :kesalahan="$errors->first('masukan.controller')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-premi-controller" tipe="number" min="0" step="1" label="Premi controller (Rp)" wire:model="masukan.premi_controller" :kesalahan="$errors->first('masukan.premi_controller')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-persen-controller" tipe="number" min="0" max="100" step="0.01" label="Upah controller (% pendapatan)" wire:model="masukan.persen_upah_controller" :kesalahan="$errors->first('masukan.persen_upah_controller')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-persen-bonus-abk" tipe="number" min="0" max="100" step="0.01" label="Bonus pasar ABK (%)" wire:model="masukan.persen_bonus_pasar_abk" :kesalahan="$errors->first('masukan.persen_bonus_pasar_abk')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-persen-bonus-controller" tipe="number" min="0" max="100" step="0.01" label="Bonus pasar controller (%)" wire:model="masukan.persen_bonus_pasar_controller" :kesalahan="$errors->first('masukan.persen_bonus_pasar_controller')" />
                                </div>
                                <div class="col-md-4">
                                    <x-masukan id="bagi-hasil-persen-zakat" tipe="number" min="0" max="100" step="0.01" label="Zakat penghasilan (%)" wire:model="masukan.persen_zakat" :kesalahan="$errors->first('masukan.persen_zakat')" />
                                </div>
                            </div>

                            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-10">
                                <h6 class="mb-0">Daftar ABK dan premi tetap</h6>
                                <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahAbk" wire:loading.attr="disabled" wire:target="tambahAbk">Tambah ABK</x-tombol>
                            </div>
                            @foreach ($abk as $indeks => $satu)
                                <div class="row align-items-start" wire:key="bagi-hasil-abk-{{ $satu['id'] ?? 'baru-'.$indeks }}">
                                    <input type="hidden" wire:model="abk.{{ $indeks }}.id">
                                    <div class="col-md-4">
                                        <x-masukan :id="'bagi-hasil-abk-nama-'.$indeks" label="Nama ABK" wire:model="abk.{{ $indeks }}.nama" :kesalahan="$errors->first('abk.'.$indeks.'.nama')" />
                                    </div>
                                    <div class="col-md-4">
                                        <x-masukan :id="'bagi-hasil-abk-keterangan-'.$indeks" label="Keterangan" wire:model="abk.{{ $indeks }}.keterangan" :kesalahan="$errors->first('abk.'.$indeks.'.keterangan')" />
                                    </div>
                                    <div class="col-md-3">
                                        <x-masukan :id="'bagi-hasil-abk-premi-'.$indeks" tipe="number" min="0" step="1" label="Premi tetap (Rp)" wire:model="abk.{{ $indeks }}.jumlah" :kesalahan="$errors->first('abk.'.$indeks.'.jumlah')" />
                                    </div>
                                    <div class="col-md-1 pt-md-35 text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'remove', 'label' => 'Hapus ABK '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'abk\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil'],
                                        ]" />
                                    </div>
                                </div>
                            @endforeach

                            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-10 mb-10">
                                <h6 class="mb-0">Entertain</h6>
                                <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahEntertain" wire:loading.attr="disabled" wire:target="tambahEntertain">Tambah penerima</x-tombol>
                            </div>
                            @foreach ($entertain as $indeks => $satu)
                                <div class="row align-items-start" wire:key="bagi-hasil-entertain-{{ $satu['id'] ?? 'baru-'.$indeks }}">
                                    <input type="hidden" wire:model="entertain.{{ $indeks }}.id">
                                    <div class="col-md-5">
                                        <x-masukan :id="'bagi-hasil-entertain-nama-'.$indeks" label="Nama penerima" wire:model="entertain.{{ $indeks }}.nama" :kesalahan="$errors->first('entertain.'.$indeks.'.nama')" />
                                    </div>
                                    <div class="col-md-5">
                                        <x-masukan :id="'bagi-hasil-entertain-jumlah-'.$indeks" tipe="number" min="0" step="1" label="Jumlah (Rp)" wire:model="entertain.{{ $indeks }}.jumlah" :kesalahan="$errors->first('entertain.'.$indeks.'.jumlah')" />
                                    </div>
                                    <div class="col-md-2 pt-md-35 text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'remove', 'label' => 'Hapus penerima entertain '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'entertain\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil'],
                                        ]" />
                                    </div>
                                </div>
                            @endforeach

                            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-10 mb-10">
                                <h6 class="mb-0">Pembagian pemodal</h6>
                                <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahPemodal" wire:loading.attr="disabled" wire:target="tambahPemodal">Tambah pemodal</x-tombol>
                            </div>
                            @foreach ($pemodal as $indeks => $satu)
                                <div class="row align-items-start" wire:key="bagi-hasil-pemodal-{{ $satu['id'] ?? 'baru-'.$indeks }}">
                                    <input type="hidden" wire:model="pemodal.{{ $indeks }}.id">
                                    <div class="col-md-5">
                                        <x-masukan :id="'bagi-hasil-pemodal-nama-'.$indeks" label="Nama pemodal" wire:model="pemodal.{{ $indeks }}.nama" :kesalahan="$errors->first('pemodal.'.$indeks.'.nama')" />
                                    </div>
                                    <div class="col-md-5">
                                        <x-masukan :id="'bagi-hasil-pemodal-persen-'.$indeks" tipe="number" min="0" max="100" step="0.001" label="Porsi (%)" wire:model="pemodal.{{ $indeks }}.persen" :kesalahan="$errors->first('pemodal.'.$indeks.'.persen')" />
                                    </div>
                                    <div class="col-md-2 pt-md-35 text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'remove', 'label' => 'Hapus pemodal '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'pemodal\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil'],
                                        ]" />
                                    </div>
                                </div>
                            @endforeach
                            @error('pemodal')
                                <div class="color-danger fs-12 mb-15">{{ $message }}</div>
                            @enderror

                            <div class="d-flex justify-content-end mt-15">
                                <x-tombol tipe="submit" ikon="uil-save" wire:loading.attr="disabled" wire:target="simpan">
                                    Simpan dan hitung ulang
                                </x-tombol>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        @endif

        @if ($this->lembar)
            {{-- Identitas lembar --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body kartu-identitas">
                        <dl class="recording-info mb-0">
                            <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $kandang->nama }}</dd></div>
                            <div><dt>Populasi</dt><dd>@angka($this->lembar['identitas']['populasi']) ekor</dd></div>
                            <div><dt>Kg terjual</dt><dd>@angka($this->lembar['identitas']['kg'], 2) kg</dd></div>
                            @isset($this->lembar['identitas']['controller'])
                                <div><dt>Controller</dt><dd>{{ $this->lembar['identitas']['controller'] }}</dd></div>
                            @endisset
                        </dl>

                        <div class="aksi-kunci">
                            @if ($this->bagiHasilTerkunci)
                                <span class="dm-tag tag-primary m-0">Terkunci</span>
                            @elseif (! $this->periode?->tertutup())
                                <x-tombol ukuran="sm" variasi="outlined" wire:click="bukaModalKunci" data-bs-toggle="modal" data-bs-target="#modal-kunci-bagi-hasil" wire:loading.attr="disabled" wire:target="bukaModalKunci, kunciBagiHasil">
                                    Kunci bagi hasil
                                </x-tombol>
                            @endif
                        </div>
                    </div>
                </div>
            </div>

            

            {{-- Angka utama --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['ringkasan']['pendapatan'])" label="Jumlah pendapatan" ikon="uil-bill" warna="primary">
                <small>Rp @angka($this->lembar['ringkasan']['pendapatan']) dari RHPP real</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['ringkasan']['pengeluaran'])" label="Total operasional pemeliharaan" ikon="uil-arrow-circle-up" warna="warning">
                <small>Rp @angka($this->lembar['ringkasan']['pengeluaran'])</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['ringkasan']['sisa_akhir'])" label="Sisa akhir diperoleh" ikon="uil-wallet" :warna="$this->lembar['ringkasan']['sisa_akhir'] < 0 ? 'danger' : 'success'">
                <small>Rp @angka($this->lembar['ringkasan']['sisa_akhir']) untuk pemodal</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['ringkasan']['abk'])" label="Total pendapatan ABK" ikon="uil-users-alt" warna="info">
                <small>Rp @angka($this->lembar['ringkasan']['abk']) untuk @angka($this->lembar['ringkasan']['jumlah_abk']) ABK</small>
            </x-dashboard.kartu>

            {{-- Layar lebar: kiri pendapatan lalu sisa, kanan pengeluaran lalu pembagian pemodal.
                 Di bawah itu dua tumpukan dilebur (tumpuk-lebur) dan kartu berurutan menurut order-*. --}}
            <div class="col-xxl-6 tumpuk-lebur">
                <div class="row h-100">
                    <x-rhpp.rincian judul="Pendapatan" lebar="col-12 order-1 rincian-kas">
                        @foreach ($this->lembar['pendapatan'] as $baris)
                            <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" />
                        @endforeach
                        <x-slot:catatan>Angkanya sama dengan pendapatan bersih {{ $kandang->nama }} di <a href="{{ route('rhpp', ['periode' => $this->periode->id, 'tab' => 'real']) }}">RHPP real</a>, yang membagi nilai panen ke tiap kandang menurut tonase.</x-slot:catatan>
                    </x-rhpp.rincian>

                    <x-rhpp.rincian judul="Sisa diperoleh" lebar="col-12 order-3 rincian-kas">
                        @foreach ($this->lembar['sisa'] as $baris)
                            <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" :masukan="$baris['masukan']" kurung />
                        @endforeach
                        <x-slot:catatan>Potongan dihitung berurutan: operasional pemeliharaan, entertain, lalu zakat dari sisa setelah entertain.</x-slot:catatan>
                    </x-rhpp.rincian>
                </div>
            </div>

            <div class="col-xxl-6 tumpuk-lebur">
                <div class="row h-100">
                    <x-rhpp.rincian judul="Pengeluaran" lebar="col-12 order-2 rincian-kas">
                        @foreach ($this->lembar['pengeluaran'] as $baris)
                            <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" :masukan="$baris['masukan']" />
                        @endforeach
                            <x-slot:catatan>
                                Angka <span class="recording-masukan">ungu</span> adalah masukan yang disalin dari lembar.
                                @isset($this->lembar['operasional']['kas'])
                                    <span class="color-success fw-500">Operasional diambil otomatis dari total biaya operasional di <a href="{{ route('kas.operasional', ['kandang' => $kandang->id, 'periode' => $this->periode->id]) }}">buku kas</a> (Rp @angka($this->lembar['operasional']['kas'])), tidak termasuk pinjaman makan dan pinjaman karyawan.</span>
                                @else
                                    Buku kas {{ $kandang->nama }} periode ini belum diisi, jadi angka operasional memakai nilai terakhir yang tersimpan.
                                @endisset
                                @foreach ($this->lembar['tidak_dijumlahkan'] as $bonus)
                                    <span class="color-warning fw-500">Bonus pasar {{ $bonus['nama'] }} Rp @angka($bonus['jumlah']) tercantum di lembar asli tetapi tidak masuk totalnya, jadi di sini juga tidak dijumlahkan.</span>
                                @endforeach
                            </x-slot:catatan>
                    </x-rhpp.rincian>

                    <x-bagi-hasil.pemodal :pemodal="$this->lembar['pemodal']" :sisa-akhir="$this->lembar['ringkasan']['sisa_akhir']" />
                </div>
            </div>

            <x-bagi-hasil.abk :abk="$this->lembar['abk']" />
        @elseif (! $this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Bagi hasil dihitung per kandang dalam satu periode. Halaman ini terisi setelah periode pertama dibuat.</p>
                    </div>
                </div>
            </div>
        @elseif (! $this->periodeKandang)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">{{ $kandang->nama }} tidak dipakai di periode ini</h5>
                        <p class="color-gray mb-0">Periode terpilih tidak mencatat chick-in di {{ $kandang->nama }}, jadi tidak ada bagi hasilnya. Anda dapat memilih periode lain dari bar atas.</p>
                    </div>
                </div>
            </div>
        @elseif (! $this->rhpp)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">RHPP real belum dicatat</h5>
                        <p class="color-gray mb-0">Pendapatan bagi hasil diambil dari RHPP real. Halaman ini terisi setelah dokumen RHPP dari inti untuk periode terpilih dicatat.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Bagi hasil belum diisi</h5>
                        <p class="color-gray mb-0">Biaya operasional, tarif, dan daftar penerima bagi hasil {{ $kandang->nama }} untuk periode terpilih belum dicatat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-modal
        id="modal-kunci-bagi-hasil"
        judul="Kunci bagi hasil {{ $kandang->nama }}"
        submit="kunciBagiHasil"
        x-on:tutup-modal-kunci-bagi-hasil.window="bootstrap.Modal.getInstance($el).hide()">
        <p class="fs-12 color-gray">
            @if ($this->sandiAdminTeratur)
                Lembar bagi hasil {{ $kandang->nama }} akan dikunci sehingga tidak dapat diubah. Masukkan password admin untuk mengunci.
            @else
                Password admin belum pernah ditetapkan. Tentukan password admin berikut; password inilah yang dipakai membuka kunci nanti dari halaman Periode.
            @endif
        </p>
        <x-masukan id="bagi-hasil-sandi" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
        @unless ($this->sandiAdminTeratur)
            <x-masukan id="bagi-hasil-sandi-ulang" label="Ulangi password admin" tipe="password" wire:model="sandiAdminUlang" :kesalahan="$errors->first('sandiAdminUlang')" />
        @endunless
        <x-slot:footer>
            <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal">Batal</x-tombol>
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="kunciBagiHasil">Kunci bagi hasil</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-konfirmasi id="konfirmasi-hapus-bagi-hasil" judul="Hapus dari daftar bagi hasil?" aksi="konfirmasiHapus" tombol="Ya, hapus" warna="danger" memuat="konfirmasiHapus">
        {{ $this->namaHapusTarget() ?: 'Data ini' }} akan dihapus dari daftar bagi hasil. Perubahan ini belum disimpan sampai tombol simpan ditekan.
    </x-konfirmasi>

    <x-memuat target="simpan, kunciBagiHasil" teks="Menyimpan bagi hasil" />
</div>
