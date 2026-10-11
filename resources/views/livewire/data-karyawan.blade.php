<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Data karyawan" :jejak="['Master data', 'Karyawan']" />

        @if ($this->daftar)
            {{-- Jumlah karyawan seluruhnya dan per kandang --}}
            <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($this->daftar['total']).' orang'" label="Seluruh karyawan" ikon="uil-users-alt" warna="primary">
                <small>{{ $this->daftar['rincian'] }}</small>
            </x-dashboard.kartu>

            @foreach ($this->daftar['kandang'] as $kandang)
                <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($kandang['jumlah']).' orang'" :label="$kandang['nama']" ikon="uil-home" :warna="$loop->odd ? 'info' : 'secondary'">
                    <small>{{ $kandang['rincian'] }}</small>
                </x-dashboard.kartu>
            @endforeach

            <x-karyawan.daftar :daftar="$this->daftar" :periode-slip="$this->periodeSlip" />
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada karyawan</h5>
                        <p class="color-gray mb-0">Daftar ini berisi ABK dan joker tiap kandang, orang yang sama dengan penerima slip di Payroll ABK.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>
</div>
