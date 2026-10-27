<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Stok dan penjualan kohe" :jejak="['Produksi', 'Kohe']">
            @if ($this->farm)
                <x-tombol.kepala warna="white" ikon="las la-plus" wire:click="tambahStok" data-bs-toggle="modal" data-bs-target="#modal-kohe-stok">Catat stok masuk</x-tombol.kepala>
                <x-tombol.kepala ikon="las la-plus" wire:click="tambahPenjualan" data-bs-toggle="modal" data-bs-target="#modal-kohe-penjualan">Catat penjualan</x-tombol.kepala>
            @endif
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif
        @error('hapus')
            <div class="col-12">
                <x-peringatan warna="danger" class="mb-25">{{ $message }}</x-peringatan>
            </div>
        @enderror

        @if ($this->farm)
            {{-- Ringkasan stok karung dan nilai penjualan --}}
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->ringkasan['tersedia']).' karung'" label="Stok tersedia" ikon="uil-box" warna="success">
                <small>Karung masuk dikurangi karung terjual</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->ringkasan['masuk']).' karung'" label="Karung masuk" ikon="uil-import" warna="primary">
                <small>@angka($this->daftarStok->count()) catatan stok masuk</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->ringkasan['terjual']).' karung'" label="Karung terjual" ikon="uil-export" warna="info">
                <small>@angka($this->daftarPenjualan->count()) penjualan ke @angka($this->ringkasan['pembeli']) pembeli</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="'Rp '.\App\Support\Format::angka($this->ringkasan['pendapatan'])" label="Nilai penjualan" ikon="uil-money-bill" warna="warning">
                <small>Seluruh penjualan kohe farm ini</small>
            </x-dashboard.kartu>

            {{-- Riwayat penjualan (HexaDash: Basic Table, Basic Usage) --}}
            <div class="col-xxl-7 mb-25">
                <x-kartu judul="Riwayat penjualan" subjudul="Total = jumlah karung × harga jual per karung" badan="p-0" class="h-100">
                    <div class="table4 p-25">
                        <div class="table-responsive">
                            <table class="table mb-0">
                                <thead>
                                    <tr class="userDatatable-header">
                                        <th><span class="userDatatable-title">Tanggal</span></th>
                                        <th><span class="userDatatable-title">Pembeli</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Karung</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Harga/karung (Rp)</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Total (Rp)</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->daftarPenjualan as $penjualan)
                                        <tr wire:key="penjualan-{{ $penjualan->id }}">
                                            <td><div class="userDatatable-content">{{ $penjualan->tanggal->translatedFormat('j M Y') }}</div></td>
                                            <td><div class="userDatatable-content fw-500">{{ $penjualan->nama_pembeli }}</div></td>
                                            <td class="text-end"><div class="userDatatable-content">@angka($penjualan->jumlah_karung)</div></td>
                                            <td class="text-end"><div class="userDatatable-content">@angka($penjualan->harga_per_karung)</div></td>
                                            <td class="text-end"><div class="userDatatable-content fw-500 color-dark">@angka($penjualan->total())</div></td>
                                            <td>
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'edit', 'label' => 'Ubah penjualan ke '.$penjualan->nama_pembeli, 'click' => 'ubahPenjualan('.$penjualan->id.')', 'modal' => '#modal-kohe-penjualan'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus penjualan ke '.$penjualan->nama_pembeli, 'click' => 'mintaHapusPenjualan('.$penjualan->id.')', 'modal' => '#konfirmasi-hapus-kohe'],
                                                ]" />
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="6" class="text-center color-light">Belum ada penjualan kohe.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </x-kartu>
            </div>

            {{-- Riwayat stok masuk --}}
            <div class="col-xxl-5 mb-25">
                <x-kartu judul="Riwayat stok masuk" subjudul="Karung kohe yang masuk dari kandang" badan="p-0" class="h-100">
                    <div class="table4 p-25">
                        <div class="table-responsive">
                            <table class="table mb-0">
                                <thead>
                                    <tr class="userDatatable-header">
                                        <th><span class="userDatatable-title">Tanggal</span></th>
                                        <th><span class="userDatatable-title">Kandang</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Karung</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->daftarStok as $stok)
                                        <tr wire:key="stok-{{ $stok->id }}">
                                            <td>
                                                <div class="userDatatable-content">{{ $stok->tanggal->translatedFormat('j M Y') }}</div>
                                                @isset($stok->keterangan)
                                                    <span class="d-block fs-13 color-light">{{ $stok->keterangan }}</span>
                                                @endisset
                                            </td>
                                            <td><div class="userDatatable-content">{{ $stok->kandang?->nama ?? '-' }}</div></td>
                                            <td class="text-end"><div class="userDatatable-content fw-500 color-dark">@angka($stok->jumlah_karung)</div></td>
                                            <td>
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'edit', 'label' => 'Ubah stok masuk '.$stok->tanggal->translatedFormat('j F Y'), 'click' => 'ubahStok('.$stok->id.')', 'modal' => '#modal-kohe-stok'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus stok masuk '.$stok->tanggal->translatedFormat('j F Y'), 'click' => 'mintaHapusStok('.$stok->id.')', 'modal' => '#konfirmasi-hapus-kohe'],
                                                ]" />
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="4" class="text-center color-light">Belum ada stok kohe yang dicatat.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </x-kartu>
            </div>
        @else
            <x-kosong judul="Belum ada farm">Buat farm dan kandang di halaman Periode untuk mulai mencatat kohe.</x-kosong>
        @endif
    </div>

    <x-memuat target="simpanStok, simpanPenjualan, hapus" teks="Menyimpan data kohe" />

    {{-- Form stok masuk --}}
    <x-modal id="modal-kohe-stok" :judul="$stokId ? 'Ubah stok masuk' : 'Catat stok masuk'" submit="simpanStok" x-on:tutup-modal-kohe-stok.window="bootstrap.Modal.getInstance($el)?.hide()">
        <div class="row">
            <div class="col-md-6">
                <div class="form-group mb-25">
                    <label for="kohe-stok-tanggal" class="il-gray fs-14 fw-500 align-center mb-10">Tanggal</label>
                    <x-pilih-tanggal id="kohe-stok-tanggal" ukuran="medium" :nilai="$tanggalStok" :kesalahan="$errors->has('tanggalStok')" x-on:tanggal-dipilih="$wire.set('tanggalStok', $event.detail)" />
                    @error('tanggalStok')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group mb-25">
                    <label class="il-gray fs-14 fw-500 align-center mb-10">Kandang asal</label>
                    <x-pilih bentuk="isian" nama="Kandang asal kohe" :label="$this->daftarKandang->firstWhere('id', $kandangStokId)?->nama ?? 'Tanpa kandang asal'" :kesalahan="$errors->has('kandangStokId')">
                        @foreach ($this->daftarKandang as $pilihan)
                            <button type="button" wire:click="$set('kandangStokId', {{ $pilihan->id }})" @class(['dropdown-item', 'active' => $kandangStokId === $pilihan->id])>{{ $pilihan->nama }}</button>
                        @endforeach
                        <button type="button" wire:click="$set('kandangStokId', null)" @class(['dropdown-item', 'active' => $kandangStokId === null])>Tanpa kandang asal</button>
                    </x-pilih>
                    @error('kandangStokId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>
            <div class="col-md-6">
                <x-masukan.ribuan id="kohe-stok-karung" properti="jumlahKarungStok" label="Jumlah karung" placeholder="Contoh: 1.200" :kesalahan="$errors->first('jumlahKarungStok')" wire:key="kohe-stok-karung-{{ $stokId ?? 'baru' }}" />
            </div>
            <div class="col-md-6">
                <x-masukan id="kohe-stok-keterangan" label="Keterangan" maxlength="255" wire:model="keteranganStok" placeholder="Boleh dikosongkan" :kesalahan="$errors->first('keteranganStok')" autocomplete="off" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal />
            @if ($stokId)
                <x-tombol wire:key="tombol-simpan-perubahan-stok" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-kohe-stok" wire:loading.attr="disabled" wire:target="simpanStok">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:key="tombol-simpan-baru-stok" wire:loading.attr="disabled" wire:target="simpanStok">Simpan stok</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    {{-- Form penjualan: nama pembeli, jumlah karung, dan harga jual per karung --}}
    <x-modal id="modal-kohe-penjualan" :judul="$penjualanId ? 'Ubah penjualan' : 'Catat penjualan'" submit="simpanPenjualan" x-on:tutup-modal-kohe-penjualan.window="bootstrap.Modal.getInstance($el)?.hide()">
        <div class="row">
            <div class="col-md-6">
                <div class="form-group mb-25">
                    <label for="kohe-jual-tanggal" class="il-gray fs-14 fw-500 align-center mb-10">Tanggal</label>
                    <x-pilih-tanggal id="kohe-jual-tanggal" ukuran="medium" :nilai="$tanggalPenjualan" :kesalahan="$errors->has('tanggalPenjualan')" x-on:tanggal-dipilih="$wire.set('tanggalPenjualan', $event.detail)" />
                    @error('tanggalPenjualan')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>
            <div class="col-md-6">
                <x-masukan id="kohe-jual-pembeli" label="Nama pembeli" maxlength="150" wire:model="namaPembeli" placeholder="Masukkan nama pembeli" :kesalahan="$errors->first('namaPembeli')" autocomplete="off" />
            </div>
            <div class="col-md-6">
                <x-masukan.ribuan id="kohe-jual-karung" properti="jumlahKarungJual" langsung label="Jumlah karung" placeholder="Contoh: 1.000" :keterangan="'Stok tersedia '.\App\Support\Format::angka($this->tersediaUntukForm).' karung.'" :kesalahan="$errors->first('jumlahKarungJual')" wire:key="kohe-jual-karung-{{ $penjualanId ?? 'baru' }}" />
            </div>
            <div class="col-md-6">
                <x-masukan.ribuan id="kohe-jual-harga" properti="hargaPerKarung" langsung label="Harga jual per karung (Rp)" placeholder="Contoh: 15.000" :kesalahan="$errors->first('hargaPerKarung')" wire:key="kohe-jual-harga-{{ $penjualanId ?? 'baru' }}" />
            </div>
            <div class="col-12">
                <div class="d-flex justify-content-between align-items-center order-bg-opacity-primary radius-xs px-20 py-15">
                    <span class="fs-14 color-gray">Total penjualan</span>
                    <span class="fs-18 fw-600 color-primary">Rp @angka($this->totalForm)</span>
                </div>
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal />
            @if ($penjualanId)
                <x-tombol wire:key="tombol-simpan-perubahan-penjualan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-kohe-penjualan" wire:loading.attr="disabled" wire:target="simpanPenjualan">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:key="tombol-simpan-baru-penjualan" wire:loading.attr="disabled" wire:target="simpanPenjualan">Simpan penjualan</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    @if ($stokId)
        <x-konfirmasi id="konfirmasi-simpan-kohe-stok" judul="Simpan perubahan stok masuk?" aksi="simpanStok" tombol="Ya, simpan perubahan">
            Tanggal, kandang asal, jumlah karung, atau keterangan stok ini akan diperbarui.
        </x-konfirmasi>
    @endif

    @if ($penjualanId)
        <x-konfirmasi id="konfirmasi-simpan-kohe-penjualan" judul="Simpan perubahan penjualan?" aksi="simpanPenjualan" tombol="Ya, simpan perubahan">
            Tanggal, pembeli, jumlah karung, atau harga jual penjualan ini akan diperbarui.
        </x-konfirmasi>
    @endif

    <x-konfirmasi id="konfirmasi-hapus-kohe" judul="Hapus data kohe?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapusStok, mintaHapusPenjualan">
        {{ $hapusLabel ?: 'Data ini' }} akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
