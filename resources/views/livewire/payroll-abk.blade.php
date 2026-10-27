<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Slip gaji ABK" :jejak="['Keuangan', 'Payroll ABK']" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->periode && ! $this->periode->tertutup())
            @foreach ($this->kandangBelumAdaSlip as $belum)
                <div class="col-12 mb-25" wire:key="belum-ada-slip-{{ $belum['periode_kandang']->id }}">
                    <x-kartu :judul="'Slip gaji '.$belum['periode_kandang']->kandang->nama.' belum dibuat'" :subjudul="$belum['abk']->count().' ABK di lembar bagi hasil: '.$belum['abk']->pluck('nama')->join(', ', ' dan ')">
                        <x-slot:ekstra>
                            <x-tombol ikon="uil-plus" wire:click="buatSlip({{ $belum['periode_kandang']->id }})" wire:loading.attr="disabled" wire:target="buatSlip">Buat slip {{ $belum['periode_kandang']->kandang->nama }}</x-tombol>
                        </x-slot:ekstra>
                        <p class="fs-14 color-light mb-0">
                            Pendapatan bagi hasil, bonus pasar, dan premi diambil otomatis dari bagi hasil kandangnya. Pinjaman terisi dari pinjaman atas nama ABK di kas operasional. Cicilan kasbon tidak dipotong otomatis; potong lewat tombol Potong di halaman Kasbon ABK setelah disepakati dengan ABK. Uang makan diambil dari transaksi Pinjaman Makan atas nama tiap ABK di kas operasional. Hari kerja, premi panen, premi geomembran, penghasilan kotoran, dan potongan lain diisi lewat tombol ubah di tiap slip.
                        </p>
                    </x-kartu>
                </div>
            @endforeach
        @endif

        @if ($this->lembar)
            {{-- Identitas dan saringan kandang --}}
            <div class="col-12 mb-25">
                <div class="card card-default card-md">
                    <div class="card-header">
                        <div class="card-extra">
                            <ul class="card-tab-links nav-tabs nav" role="tablist">
                                <li>
                                    <a
                                        href="{{ route('payroll.abk', ['periode' => $this->periode->id]) }}"
                                        role="tab"
                                        wire:click.prevent="pilihKandang"
                                        @class(['active' => ! $this->terpilih])
                                        aria-selected="{{ $this->terpilih ? 'false' : 'true' }}"
                                    >Semua kandang</a>
                                </li>
                                @foreach ($this->daftarKandang as $pilihan)
                                    <li>
                                        <a
                                            href="{{ route('payroll.abk', ['periode' => $this->periode->id, 'kandang' => $pilihan->id]) }}"
                                            role="tab"
                                            wire:click.prevent="pilihKandang({{ $pilihan->id }})"
                                            @class(['active' => $pilihan->is($this->terpilih)])
                                            aria-selected="{{ $pilihan->is($this->terpilih) ? 'true' : 'false' }}"
                                        >{{ $pilihan->kandang->nama }}</a>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
                    <div class="card-body">
                        <x-info class="mb-0">
                            <x-info.butir label="Farm">Misjiwati / K0242</x-info.butir>
                            @if ($this->periode->notaPanen->isNotEmpty())
                                <x-info.butir label="Periode panen">{{ $this->periode->notaPanen->min('mulai')->translatedFormat('j F') }} s/d {{ $this->periode->notaPanen->max('selesai')->translatedFormat('j F Y') }}</x-info.butir>
                            @endif
                            <x-info.butir label="Karyawan">@foreach ($this->lembar['jabatan'] as $jabatan => $jumlah)
                                        @angka($jumlah) {{ $jabatan }}{{ $loop->last ? '' : ', ' }}
                                    @endforeach</x-info.butir>
                        </x-info>
                    </div>
                </div>
            </div>

            {{-- Angka utama --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['total']['pendapatan'])" label="Total pendapatan" ikon="uil-bill" warna="primary">
                <small>Rp @angka($this->lembar['total']['pendapatan'])</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['total']['potongan'])" label="Total potongan" ikon="uil-minus-circle" warna="warning">
                <small>Rp @angka($this->lembar['total']['potongan'])</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::juta($this->lembar['total']['bersih'])" label="Pendapatan bersih dibayarkan" ikon="uil-wallet" warna="success">
                <small>Rp @angka($this->lembar['total']['bersih'])</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->lembar['total']['orang']).' orang'" label="Karyawan dibayar" ikon="uil-users-alt" warna="info">
                <small>rata-rata bersih Rp @angka($this->lembar['total']['bersih'] / $this->lembar['total']['orang']) per orang</small>
            </x-dashboard.kartu>

            <x-payroll.rekap :lembar="$this->lembar" />

            @foreach ($this->lembar['kandang'] as $kandang)
                @if (count($this->lembar['kandang']) > 1)
                    <div class="col-12" wire:key="judul-slip-{{ $kandang['id'] }}">
                        <h6 class="slip-gaji__kandang">Slip {{ $kandang['nama'] }} <span>@angka($kandang['total']['orang']) orang, bersih Rp @angka($kandang['total']['bersih'])</span></h6>
                    </div>
                @endif
                @foreach ($kandang['slip'] as $slip)
                    <x-payroll.slip :slip="$slip" :periode="$this->periode->nama" :bisa-diubah="! $this->periode->tertutup()" wire:key="slip-{{ $slip['id'] }}" />
                @endforeach
            @endforeach

            <div class="col-lg-12">
                <p class="fs-13 color-light mb-0">
                    Pendapatan bagi hasil, bonus pasar, dan premi pemeliharaan ABK adalah bagian rata dari angka kandangnya di halaman Bagi hasil; premi tetap ditambahkan di atasnya. Komponen lain dan potongan dicatat per orang.
                </p>
            </div>
        @elseif ($this->periode && ($this->periode->tertutup() || $this->kandangBelumAdaSlip === []))
            <x-kosong judul="Belum ada slip gaji di periode ini">Slip gaji periode terpilih dibuat setelah panen selesai dan bagi hasil tiap kandang dihitung.</x-kosong>
        @else
            <x-kosong judul="Belum ada periode">Slip gaji dibuat per periode. Halaman ini terisi setelah periode pertama dibuat.</x-kosong>
        @endif
    </div>

    <x-memuat target="pilihKandang" teks="Memuat slip gaji" cepat />
    <x-memuat target="buatSlip" teks="Membuat slip gaji" />
    <x-memuat target="simpan" teks="Menyimpan slip gaji" />
    <x-memuat target="hapus" teks="Menghapus slip gaji" />

    @if ($this->periode && ! $this->periode->tertutup())
        <x-modal
            id="modal-slip"
            ukuran="lg"
            :judul="'Ubah slip gaji '.$namaSlip"
            x-on:tutup-modal-slip.window="bootstrap.Modal.getInstance($el).hide()"
            submit="simpan">
            @if ($slipIkutBagiHasil)
                <x-peringatan warna="info">Pendapatan bagi hasil, bonus pasar, premi pemeliharaan, dan premi tetap dihitung dari halaman Bagi hasil, tidak diisi di sini.</x-peringatan>
            @endif

            <h6 class="fs-14 fw-500 mb-15">Pendapatan</h6>
            <div class="row">
                <div class="col-md-4">
                    <x-masukan id="slip-hari-kerja" label="Hari kerja" tipe="number" min="0" max="366" step="1" wire:model="isian.hari_kerja" :kesalahan="$errors->first('isian.hari_kerja')" />
                </div>
                @unless ($slipIkutBagiHasil)
                    <div class="col-md-4">
                        <x-masukan.ribuan id="slip-gaji-pokok" properti="isian.gaji_pokok" label="Gaji pokok (Rp)" :kesalahan="$errors->first('isian.gaji_pokok')" wire:key="slip-gaji-pokok-{{ $slipId }}" />
                    </div>
                @endunless
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-premi-pemeliharaan" properti="isian.premi_pemeliharaan" :label="$slipIkutBagiHasil ? 'Premi pemeliharaan tambahan (Rp)' : 'Premi pemeliharaan (Rp)'" :kesalahan="$errors->first('isian.premi_pemeliharaan')" wire:key="slip-premi-pemeliharaan-{{ $slipId }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-premi-panen" properti="isian.premi_panen" label="Premi panen (Rp)" :kesalahan="$errors->first('isian.premi_panen')" wire:key="slip-premi-panen-{{ $slipId }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-premi-geomembran" properti="isian.premi_geomembran" label="Premi pasang geomembran (Rp)" :kesalahan="$errors->first('isian.premi_geomembran')" wire:key="slip-premi-geomembran-{{ $slipId }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-kotoran" properti="isian.penghasilan_kotoran" label="Penghasilan kotoran (Rp)" :kesalahan="$errors->first('isian.penghasilan_kotoran')" wire:key="slip-kotoran-{{ $slipId }}" />
                </div>
            </div>

            <h6 class="fs-14 fw-500 mb-15">Potongan</h6>
            <div class="row">
                <div class="col-md-4">
                    {{-- Uang makan tidak diketik: mengikuti transaksi Pinjaman Makan atas nama orang ini di kas operasional. --}}
                    <div class="form-group mb-25">
                        <span class="il-gray fs-14 fw-500 align-center mb-10 d-block">Uang makan (Rp)</span>
                        <div class="form-control ih-medium ip-gray radius-xs b-light px-15 d-flex align-items-center bg-normal" aria-readonly="true">@angka($uangMakanSlip['jumlah'] ?? 0)</div>
                        <small class="d-block mt-1 fs-13 color-light">
                            @if ($uangMakanSlip['dari_kas'] ?? false)
                                Dari kas operasional: @angka($uangMakanSlip['transaksi']) transaksi Pinjaman Makan atas nama {{ $namaSlip }}.
                            @else
                                Belum ada Pinjaman Makan atas nama {{ $namaSlip }} di kas operasional; catat dengan uraian yang menyebut namanya.
                            @endif
                        </small>
                    </div>
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-pinjaman" properti="isian.pinjaman" label="Pinjaman ABK dari kas (Rp)" :kesalahan="$errors->first('isian.pinjaman')" wire:key="slip-pinjaman-{{ $slipId }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="slip-potongan-lain" properti="isian.potongan_lain" label="Potongan lain (Rp)" :kesalahan="$errors->first('isian.potongan_lain')" wire:key="slip-potongan-lain-{{ $slipId }}" />
                </div>
                <div class="col-12">
                    <x-masukan id="slip-keterangan-potongan" label="Keterangan potongan lain" maxlength="255" placeholder="Contoh: biaya lain di luar kasbon" wire:model="isian.keterangan_potongan_lain" :kesalahan="$errors->first('isian.keterangan_potongan_lain')" />
                </div>
            </div>

            @if ($kasbonSlip)
                <h6 class="fs-14 fw-500 mb-15">Cicilan kasbon</h6>
                <div class="row">
                    @foreach ($kasbonSlip as $idPotongan => $kasbon)
                        <div class="col-md-6" wire:key="slip-kasbon-{{ $slipId }}-{{ $idPotongan }}">
                            <x-masukan.ribuan id="slip-kasbon-{{ $idPotongan }}" properti="isianKasbon.{{ $idPotongan }}" :label="$kasbon['label']" :keterangan="$kasbon['keterangan']" :kesalahan="$errors->first('isianKasbon.'.$idPotongan)" />
                        </div>
                    @endforeach
                </div>
                <p class="fs-13 color-light mb-0">Potongan yang lebih kecil dari rencana membuat sisanya dibagi ke slip periode berikutnya. Potongan baru dibuat atau dibatalkan di halaman <a href="{{ route('kasbon.abk', ['periode' => $this->periode->id]) }}">Kasbon ABK</a>.</p>
            @endif

            <x-slot:footer>
                <x-tombol.batal wire:click="batal" />
                <x-tombol data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-slip" wire:loading.attr="disabled" wire:target="simpan, hapus">Simpan perubahan</x-tombol>
            </x-slot:footer>
        </x-modal>

        <x-konfirmasi id="konfirmasi-simpan-slip" judul="Simpan perubahan slip gaji?" aksi="simpan" tombol="Ya, simpan perubahan">
            Hari kerja, pendapatan, dan potongan slip gaji {{ $namaSlip }} akan diperbarui.
        </x-konfirmasi>

        <x-konfirmasi id="konfirmasi-hapus-slip" judul="Hapus slip gaji?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
            Slip gaji {{ $namaHapus }} dihapus permanen. Slipnya dapat dibuat lagi dari tombol Buat slip selama ABK itu masih ada di lembar bagi hasil.
        </x-konfirmasi>
    @endif
</div>
