<div class="container-fluid" wire:poll.60s>
    <div class="row">
        <x-breadcrumb judul="Akun pengguna" :jejak="['Pengaturan', 'Akun pengguna']">
            <x-tombol.kepala ikon="las la-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-akun">Tambah akun</x-tombol.kepala>
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @error('akun_hapus')
            <div class="col-12">
                <x-peringatan warna="danger" bisaDitutup="true" class="mb-25">{{ $message }}</x-peringatan>
            </div>
        @enderror

        {{-- Jumlah akun, yang sedang online, dan sesi yang belum keluar --}}
        <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka(count($this->daftar)).' akun'" label="Seluruh akun" ikon="uil-users-alt" warna="primary">
            <small>Bisa masuk ke ERP dengan email dan password</small>
        </x-dashboard.kartu>
        <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($this->jumlahOnline).' akun'" label="Sedang online" ikon="uil-signal-alt-3" warna="success">
            <small>Membuka ERP dalam {{ \App\Models\Sesi::MENIT_ONLINE }} menit terakhir</small>
        </x-dashboard.kartu>
        <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($this->sesiMasuk->count()).' perangkat'" label="Sesi masuk" ikon="uil-desktop" warna="info">
            <small>Belum keluar dan aktif dalam {{ config('session.lifetime') }} menit terakhir</small>
        </x-dashboard.kartu>

        <x-akun.daftar :daftar="$this->daftar" />

        @if ($this->sesiMasuk->isNotEmpty())
            <x-akun.sesi :sesi="$this->sesiMasuk" :sesi-ini="session()->getId()" />
        @else
            <x-kosong judul="Tidak ada yang sedang masuk">
                Sesi muncul di sini setiap kali seseorang masuk ke ERP, lengkap dengan perangkat dan waktu aktif terakhirnya.
            </x-kosong>
        @endif
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan akun pengguna" />

    <x-modal
        id="modal-akun"
        :judul="$akunId ? 'Ubah akun' : 'Tambah akun'"
        submit="simpan"
        aksi-tutup="batal"
        x-on:tutup-modal-akun.window="bootstrap.Modal.getInstance($el)?.hide()"
    >
        <div class="row">
            <div class="col-12">
                <x-masukan id="akun-nama" label="Nama" maxlength="255" wire:model="nama" :kesalahan="$errors->first('nama')" placeholder="Masukkan nama pengguna" autocomplete="off" />
            </div>
            <div class="col-12">
                <x-masukan id="akun-email" tipe="email" label="Email" maxlength="255" wire:model="email" :kesalahan="$errors->first('email')" placeholder="nama@contoh.com" keterangan="Dipakai untuk masuk ke ERP." autocomplete="off" />
            </div>
            <div class="col-md-6">
                <x-masukan
                    id="akun-password"
                    tipe="password"
                    :label="$akunId ? 'Password baru' : 'Password'"
                    maxlength="255"
                    wire:model="password"
                    :kesalahan="$errors->first('password')"
                    :keterangan="$akunId ? 'Kosongkan bila tidak diganti.' : 'Minimal '.\App\Models\User::PANJANG_PASSWORD_MINIMAL.' karakter.'"
                    autocomplete="new-password"
                />
            </div>
            <div class="col-md-6">
                <x-masukan id="akun-password-ulang" tipe="password" label="Ulangi password" maxlength="255" wire:model="password_confirmation" autocomplete="new-password" />
            </div>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            @if ($akunId)
                <x-tombol wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-akun" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:key="tombol-simpan-baru" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    @if ($akunId)
        <x-konfirmasi id="konfirmasi-simpan-akun" judul="Simpan perubahan akun?" aksi="simpan" tombol="Ya, simpan perubahan">
            Nama, email, atau password akun ini akan diperbarui. Bila password diganti, akun ini dikeluarkan dari perangkat lain dan harus masuk lagi dengan password baru.
        </x-konfirmasi>
    @endif

    <x-konfirmasi id="konfirmasi-hapus-akun" judul="Hapus akun?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
        {{ $namaHapus ?: 'Akun ini' }} tidak bisa masuk lagi dan langsung dikeluarkan dari semua perangkat. Riwayat aktivitas tetap tersimpan. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
