<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Data karyawan" :jejak="['Master data', 'Karyawan']">
            <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-karyawan">Tambah karyawan</x-tombol.kepala>
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @error('karyawan_hapus')
            <div class="col-12">
                <x-peringatan warna="danger" bisaDitutup="true" class="mb-4">{{ $message }}</x-peringatan>
            </div>
        @enderror

        @if ($this->daftar)
            {{-- Jumlah karyawan seluruhnya dan per kandang --}}
            <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($this->daftar['total']).' orang'" label="Seluruh karyawan" ikon="bi-people" warna="primary">
                <small>{{ $this->daftar['rincian'] }}</small>
            </x-dashboard.kartu>

            @foreach ($this->daftar['kandang'] as $kandang)
                <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($kandang['jumlah']).' orang'" :label="$kandang['nama']" ikon="bi-house" :warna="$loop->odd ? 'info' : 'secondary'">
                    <small>{{ $kandang['rincian'] }}</small>
                </x-dashboard.kartu>
            @endforeach

            <x-karyawan.daftar :daftar="$this->daftar" :periode-slip="$this->periodeSlip" />
        @else
            <x-kosong judul="Belum ada karyawan">
                Daftar ini berisi ABK dan joker tiap kandang, orang yang sama dengan penerima slip di Payroll ABK.
                <x-slot:aksi>
                    <x-tombol ikon="bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-karyawan">Tambah karyawan</x-tombol>
                </x-slot:aksi>
            </x-kosong>
        @endif
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan data karyawan" />

    <x-modal
        id="modal-karyawan"
        :judul="$karyawanId ? 'Ubah karyawan' : 'Tambah karyawan'"
        submit="simpan"
        aksi-tutup="batal"
        x-on:tutup-modal-karyawan.window="bootstrap.Modal.getInstance($el)?.hide()"
    >
        <div class="row">
            <div class="col-12">
                <x-masukan id="karyawan-nama" label="Nama karyawan" maxlength="150" wire:model="nama" :kesalahan="$errors->first('nama')" placeholder="Masukkan nama karyawan" autocomplete="off" />
            </div>
            <div class="col-md-6">
                <div class="mb-3 mb-4">
                    <label class="form-label fw-medium mb-2">Jabatan</label>
                    <x-pilih bentuk="isian" nama="Jabatan karyawan" :label="\App\Enums\Jabatan::tryFrom($jabatan)?->label() ?? 'Pilih jabatan'" :kesalahan="$errors->has('jabatan')">
                        @foreach (\App\Enums\Jabatan::cases() as $pilihan)
                            <button type="button" wire:click="$set('jabatan', '{{ $pilihan->value }}')" @class(['dropdown-item', 'active' => $jabatan === $pilihan->value])>{{ $pilihan->label() }}</button>
                        @endforeach
                    </x-pilih>
                    @error('jabatan')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3 mb-4">
                    <label class="form-label fw-medium mb-2">Kandang</label>
                    <x-pilih bentuk="isian" nama="Kandang tempat bertugas" :label="$this->daftarKandang->firstWhere('id', $kandangId)?->nama ?? 'Belum ditempatkan'" :kesalahan="$errors->has('kandangId')">
                        @foreach ($this->daftarKandang as $pilihan)
                            <button type="button" wire:click="$set('kandangId', {{ $pilihan->id }})" @class(['dropdown-item', 'active' => $kandangId === $pilihan->id])>{{ $pilihan->nama }}</button>
                        @endforeach
                        <button type="button" wire:click="$set('kandangId', null)" @class(['dropdown-item', 'active' => $kandangId === null])>Belum ditempatkan</button>
                    </x-pilih>
                    @error('kandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>
            <div class="col-12">
                <x-masukan id="karyawan-keterangan" label="Keterangan" maxlength="255" wire:model="keterangan" :kesalahan="$errors->first('keterangan')" placeholder="Contoh: ketua ABK" keterangan="Boleh dikosongkan." autocomplete="off" />
            </div>
            <div class="col-12">
                <h6 class="fw-medium mb-3">Nilai bawaan slip gaji</h6>
            </div>
            <div class="col-md-4">
                <x-masukan.ribuan id="karyawan-gaji-pokok" properti="gajiPokok" teks label="Gaji pokok (Rp)" :kesalahan="$errors->first('gajiPokok')" wire:key="karyawan-gaji-pokok-{{ $karyawanId ?? 'baru' }}" />
            </div>
            <div class="col-md-4">
                <x-masukan id="karyawan-hari-kerja" tipe="number" min="0" max="366" step="1" label="Hari kerja" wire:model="hariKerja" :kesalahan="$errors->first('hariKerja')" placeholder="Contoh: 30" />
            </div>
            <div class="col-md-4">
                <x-masukan id="karyawan-tanggal-gajian" tipe="number" min="1" max="31" step="1" label="Tanggal gajian" wire:model="tanggalGajian" :kesalahan="$errors->first('tanggalGajian')" placeholder="Contoh: 25" />
            </div>
            <div class="col-12">
                <small class="d-block mb-4 small text-body-secondary">Terisi otomatis di slip gaji baru karyawan ini dan boleh diubah per slip. Gaji pokok tidak dipakai ABK yang ikut bagi hasil. Kosongkan bila tidak ada nilai bawaan.</small>
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            @if ($karyawanId)
                <x-tombol wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-karyawan" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:key="tombol-simpan-baru" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    @if ($karyawanId)
        <x-konfirmasi id="konfirmasi-simpan-karyawan" judul="Simpan perubahan karyawan?" aksi="simpan" tombol="Ya, simpan perubahan">
            Nama, jabatan, kandang, keterangan, atau nilai bawaan slip gaji karyawan ini akan diperbarui. Slip gaji yang sudah dibuat tidak ikut berubah.
        </x-konfirmasi>
    @endif

    <x-konfirmasi id="konfirmasi-hapus-karyawan" judul="Hapus karyawan?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
        {{ $namaHapus ?: 'Karyawan ini' }} akan dihapus dari daftar karyawan dan dari anggota project. Slip gaji yang sudah dibuat tetap tersimpan. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
