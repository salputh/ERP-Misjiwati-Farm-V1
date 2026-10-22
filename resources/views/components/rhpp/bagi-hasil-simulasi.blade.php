@props(['periodeKandang', 'masukan', 'abk', 'entertain', 'pemodal', 'proyeksi', 'hasil', 'sumberAsumsi', 'siapSimulasi'])

<div class="col-lg-12 mb-25">
    <div class="row">
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body">
                    <dl class="recording-info mb-0">
                        <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                        <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                        <div><dt>Kandang</dt><dd>{{ $periodeKandang->kandang->nama }}</dd></div>
                        @if ($proyeksi)
                            <div><dt>Populasi</dt><dd>@angka($proyeksi['doc']) ekor</dd></div>
                            <div><dt>Kg terjual</dt><dd>@angka($proyeksi['berat'], 2) kg</dd></div>
                        @endif
                        @if ($hasil && $hasil['identitas']['controller'])
                            <div><dt>Controller</dt><dd>{{ $hasil['identitas']['controller'] }}</dd></div>
                        @endif
                    </dl>
                </div>
            </div>
        </div>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="$proyeksi && $proyeksi['laba'] !== null ? \App\Support\Format::juta($proyeksi['laba']) : '—'" label="Jumlah pendapatan" ikon="uil-bill" warna="primary">
            @if ($proyeksi && $proyeksi['laba'] !== null)
                <small>Rp @angka($proyeksi['laba']) dari RHPP simulasi untuk bagi hasil</small>
            @elseif ($proyeksi)
                <small>Belum dapat dihitung. Penjualan ayam: Rp @angka($proyeksi['penjualan']). Lengkapi biaya sapronak di RHPP simulasi.</small>
            @else
                <small>Belum ada proyeksi panen Kandang 2 untuk periode ini.</small>
            @endif
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="$hasil ? \App\Support\Format::juta($hasil['ringkasan']['pengeluaran']) : '—'" label="Total operasional pemeliharaan" ikon="uil-arrow-circle-up" warna="warning">
            @if ($hasil)
                <small>Rp @angka($hasil['ringkasan']['pengeluaran'])</small>
            @else
                <small>Menunggu asumsi simulasi bagi hasil yang lengkap</small>
            @endif
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="$hasil ? \App\Support\Format::juta($hasil['ringkasan']['sisa_akhir']) : '—'" label="Sisa akhir diperoleh" ikon="uil-wallet" :warna="$hasil && $hasil['ringkasan']['sisa_akhir'] < 0 ? 'danger' : 'success'">
            @if ($hasil)
                <small>Rp @angka($hasil['ringkasan']['sisa_akhir']) untuk pemodal</small>
            @else
                <small>Ditampilkan setelah asumsi pembagian bisa dihitung</small>
            @endif
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="$hasil ? \App\Support\Format::juta($hasil['ringkasan']['abk']) : '—'" label="Total pendapatan ABK" ikon="uil-users-alt" warna="info">
            @if ($hasil)
                <small>Rp @angka($hasil['ringkasan']['abk']) untuk @angka($hasil['ringkasan']['jumlah_abk']) ABK</small>
            @else
                <small>Ditampilkan setelah asumsi pembagian bisa dihitung</small>
            @endif
        </x-dashboard.kartu>
    </div>

    @if ($hasil)
        <div class="row">
        <div class="col-xxl-6 tumpuk-lebur">
            <div class="row h-100">
                <x-rhpp.rincian judul="Pendapatan" lebar="col-12 order-1 rincian-kas">
                    @foreach ($hasil['pendapatan'] as $baris)
                        <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" />
                    @endforeach
                    <x-slot:catatan>Pendapatan dan biaya sapronak mengikuti RHPP simulasi pada periode ini.</x-slot:catatan>
                </x-rhpp.rincian>

                <x-rhpp.rincian judul="Sisa diperoleh" lebar="col-12 order-3 rincian-kas">
                    @foreach ($hasil['sisa'] as $baris)
                        <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" :masukan="$baris['masukan']" kurung />
                    @endforeach
                </x-rhpp.rincian>
            </div>
        </div>

        <div class="col-xxl-6 tumpuk-lebur">
            <div class="row h-100">
                <x-rhpp.rincian judul="Pengeluaran" lebar="col-12 order-2 rincian-kas">
                    @foreach ($hasil['pengeluaran'] as $baris)
                        <x-rhpp.baris :label="$baris['label']" :angka="$baris['jumlah']" :satuan="$baris['rumus']" :tebal="$baris['tebal']" :sorot="$baris['sorot']" :masukan="$baris['masukan']" />
                    @endforeach
                    <x-slot:catatan>Asumsi yang diubah di bawah hanya berlaku untuk simulasi ini.</x-slot:catatan>
                </x-rhpp.rincian>

                <x-bagi-hasil.pemodal :pemodal="$hasil['pemodal']" :sisa-akhir="$hasil['ringkasan']['sisa_akhir']" />
            </div>
        </div>

        <x-bagi-hasil.abk :abk="$hasil['abk']" />
        </div>
    @endif

    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Simulasi bagi hasil {{ $periodeKandang->kandang->nama }}</h6>
            <div class="card-extra fs-12 color-gray">Pendapatan dan sapronak mengikuti simulasi RHPP periode ini. Hasil berubah otomatis saat asumsi diubah dan tidak disimpan.</div>
        </div>
        <div class="card-body px-0">
            @if ($sumberAsumsi)
                <x-peringatan warna="info" class="mb-20">
                    Periode ini belum memiliki asumsi bagi hasil. Nilai awal ABK, tarif, entertain, dan pemodal diambil dari {{ $sumberAsumsi }} sebagai referensi simulasi; ubah sesuai kebutuhan periode ini.
                </x-peringatan>
            @endif

            @unless ($siapSimulasi)
                <x-peringatan warna="warning" class="mb-20">
                    Perhitungan baru tersedia setelah panen dan biaya sapronak pada tab Simulasi RHPP dapat dihitung.
                </x-peringatan>
            @endunless

            <div>
                <h6 class="mb-15">Pengeluaran dan tarif</h6>
                <div class="row">
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-operasional" tipe="text" inputmode="numeric" x-data="isianRibuan('masukanBagiHasil.operasional', ',', true)" x-on:input="format" x-on:blur="kirim" label="Operasional kandang (Rp)" keterangan="Nilai awal dari total biaya kas Kandang 2 periode ini, tidak termasuk pinjaman. Bisa diubah untuk simulasi." :kesalahan="$errors->first('masukanBagiHasil.operasional')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-tarif-abk" tipe="text" inputmode="numeric" x-data="isianRibuan('masukanBagiHasil.tarif_gaji_abk_per_kg', ',', true)" x-on:input="format" x-on:blur="kirim" label="Tarif gaji ABK per kg (Rp)" :kesalahan="$errors->first('masukanBagiHasil.tarif_gaji_abk_per_kg')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-premi-pemeliharaan" tipe="text" inputmode="numeric" x-data="isianRibuan('masukanBagiHasil.premi_pemeliharaan_abk', ',', true)" x-on:input="format" x-on:blur="kirim" label="Premi pemeliharaan ABK (Rp)" :kesalahan="$errors->first('masukanBagiHasil.premi_pemeliharaan_abk')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-controller" label="Nama controller" maxlength="150" wire:model.live.debounce.300ms="masukanBagiHasil.controller" :kesalahan="$errors->first('masukanBagiHasil.controller')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-premi-controller" tipe="text" inputmode="numeric" x-data="isianRibuan('masukanBagiHasil.premi_controller', ',', true)" x-on:input="format" x-on:blur="kirim" label="Premi controller (Rp)" :kesalahan="$errors->first('masukanBagiHasil.premi_controller')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-persen-controller" tipe="number" min="0" max="100" step="0.01" label="Upah controller (% pendapatan)" wire:model.live.debounce.300ms="masukanBagiHasil.persen_upah_controller" :kesalahan="$errors->first('masukanBagiHasil.persen_upah_controller')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-persen-bonus-abk" tipe="number" min="0" max="100" step="0.01" label="Bonus pasar ABK (%)" wire:model.live.debounce.300ms="masukanBagiHasil.persen_bonus_pasar_abk" :kesalahan="$errors->first('masukanBagiHasil.persen_bonus_pasar_abk')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-persen-bonus-controller" tipe="number" min="0" max="100" step="0.01" label="Bonus pasar controller (%)" wire:model.live.debounce.300ms="masukanBagiHasil.persen_bonus_pasar_controller" :kesalahan="$errors->first('masukanBagiHasil.persen_bonus_pasar_controller')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="simulasi-bagi-hasil-persen-zakat" tipe="number" min="0" max="100" step="0.01" label="Zakat penghasilan (%)" wire:model.live.debounce.300ms="masukanBagiHasil.persen_zakat" :kesalahan="$errors->first('masukanBagiHasil.persen_zakat')" />
                    </div>
                </div>

                @error('pemodalSimulasi')
                    <x-peringatan warna="danger" class="mb-20">{{ $message }}</x-peringatan>
                @enderror

                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-10">
                    <h6 class="mb-0">Daftar ABK dan premi tetap</h6>
                    <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahAbkSimulasi">Tambah ABK</x-tombol>
                </div>
                @foreach ($abk as $indeks => $satu)
                    <div class="row align-items-start" wire:key="simulasi-bagi-hasil-abk-{{ $indeks }}">
                        <div class="col-md-4">
                            <x-masukan :id="'simulasi-bagi-hasil-abk-nama-'.$indeks" label="Nama ABK" wire:model.live.debounce.300ms="abkSimulasi.{{ $indeks }}.nama" :kesalahan="$errors->first('abkSimulasi.'.$indeks.'.nama')" />
                        </div>
                        <div class="col-md-4">
                            <x-masukan :id="'simulasi-bagi-hasil-abk-keterangan-'.$indeks" label="Keterangan" wire:model.live.debounce.300ms="abkSimulasi.{{ $indeks }}.keterangan" :kesalahan="$errors->first('abkSimulasi.'.$indeks.'.keterangan')" />
                        </div>
                        <div class="col-md-3">
                            <x-masukan :id="'simulasi-bagi-hasil-abk-premi-'.$indeks" tipe="text" inputmode="numeric" x-data="isianRibuan('abkSimulasi.{{ $indeks }}.jumlah', ',', true)" x-on:input="format" x-on:blur="kirim" label="Premi tetap (Rp)" :kesalahan="$errors->first('abkSimulasi.'.$indeks.'.jumlah')" />
                        </div>
                        <div class="col-md-1 pt-md-35 text-end">
                            <x-aksi.ikon :aksi="[
                                ['kelas' => 'remove', 'label' => 'Hapus ABK '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'abk\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil-simulasi'],
                            ]" />
                        </div>
                    </div>
                @endforeach

                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-10 mb-10">
                    <h6 class="mb-0">Entertain</h6>
                    <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahEntertainSimulasi">Tambah penerima</x-tombol>
                </div>
                @foreach ($entertain as $indeks => $satu)
                    <div class="row align-items-start" wire:key="simulasi-bagi-hasil-entertain-{{ $indeks }}">
                        <div class="col-md-5">
                            <x-masukan :id="'simulasi-bagi-hasil-entertain-nama-'.$indeks" label="Nama penerima" wire:model.live.debounce.300ms="entertainSimulasi.{{ $indeks }}.nama" :kesalahan="$errors->first('entertainSimulasi.'.$indeks.'.nama')" />
                        </div>
                        <div class="col-md-5">
                            <x-masukan :id="'simulasi-bagi-hasil-entertain-jumlah-'.$indeks" tipe="text" inputmode="numeric" x-data="isianRibuan('entertainSimulasi.{{ $indeks }}.jumlah', ',', true)" x-on:input="format" x-on:blur="kirim" label="Jumlah (Rp)" :kesalahan="$errors->first('entertainSimulasi.'.$indeks.'.jumlah')" />
                        </div>
                        <div class="col-md-2 pt-md-35 text-end">
                            <x-aksi.ikon :aksi="[
                                ['kelas' => 'remove', 'label' => 'Hapus penerima entertain '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'entertain\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil-simulasi'],
                            ]" />
                        </div>
                    </div>
                @endforeach

                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-10 mb-10">
                    <h6 class="mb-0">Pembagian pemodal</h6>
                    <x-tombol ukuran="sm" variasi="outlined" warna="primary" wire:click="tambahPemodalSimulasi">Tambah pemodal</x-tombol>
                </div>
                @foreach ($pemodal as $indeks => $satu)
                    <div class="row align-items-start" wire:key="simulasi-bagi-hasil-pemodal-{{ $indeks }}">
                        <div class="col-md-5">
                            <x-masukan :id="'simulasi-bagi-hasil-pemodal-nama-'.$indeks" label="Nama pemodal" wire:model.live.debounce.300ms="pemodalSimulasi.{{ $indeks }}.nama" :kesalahan="$errors->first('pemodalSimulasi.'.$indeks.'.nama')" />
                        </div>
                        <div class="col-md-5">
                            <x-masukan :id="'simulasi-bagi-hasil-pemodal-persen-'.$indeks" tipe="number" min="0" max="100" step="0.001" label="Porsi (%)" wire:model.live.debounce.300ms="pemodalSimulasi.{{ $indeks }}.persen" :kesalahan="$errors->first('pemodalSimulasi.'.$indeks.'.persen')" />
                        </div>
                        <div class="col-md-2 pt-md-35 text-end">
                            <x-aksi.ikon :aksi="[
                                ['kelas' => 'remove', 'label' => 'Hapus pemodal '.($satu['nama'] ?: 'tanpa nama'), 'click' => 'mintaHapus(\'pemodal\', '.$indeks.')', 'modal' => '#konfirmasi-hapus-bagi-hasil-simulasi'],
                            ]" />
                        </div>
                    </div>
                @endforeach
                @error('pemodalSimulasi')
                    <div class="color-danger fs-12 mb-15">{{ $message }}</div>
                @enderror

            </div>
        </div>
    </div>

    <x-konfirmasi id="konfirmasi-hapus-bagi-hasil-simulasi" judul="Hapus dari daftar simulasi?" aksi="konfirmasiHapus" tombol="Ya, hapus" warna="danger" memuat="konfirmasiHapus">
        {{ $this->namaHapusTarget() ?: 'Data ini' }} akan dihapus dari daftar simulasi bagi hasil.
    </x-konfirmasi>
</div>
