<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Slip gaji ABK" :jejak="['Keuangan', 'Payroll ABK']" />

        @if ($this->lembar)
            {{-- Identitas dan saringan kandang --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-header border-0">
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
                    <div class="card-body pt-0">
                        <dl class="recording-info mb-0">
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            @if ($this->periode->notaPanen->isNotEmpty())
                                <div><dt>Periode panen</dt><dd>{{ $this->periode->notaPanen->min('mulai')->translatedFormat('j F') }} s/d {{ $this->periode->notaPanen->max('selesai')->translatedFormat('j F Y') }}</dd></div>
                            @endif
                            <div>
                                <dt>Karyawan</dt>
                                <dd>
                                    @foreach ($this->lembar['jabatan'] as $jabatan => $jumlah)
                                        @angka($jumlah) {{ $jabatan }}{{ $loop->last ? '' : ', ' }}
                                    @endforeach
                                </dd>
                            </div>
                        </dl>
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
                    <x-payroll.slip :slip="$slip" :periode="$this->periode->nama" wire:key="slip-{{ $slip['id'] }}" />
                @endforeach
            @endforeach

            <div class="col-lg-12">
                <p class="fs-12 color-gray mb-0">
                    Pendapatan bagi hasil, bonus pasar, dan premi pemeliharaan ABK adalah bagian rata dari angka kandangnya di halaman Bagi hasil; premi tetap ditambahkan di atasnya. Komponen lain dan potongan dicatat per orang.
                </p>
            </div>
        @elseif ($this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada slip gaji di periode ini</h5>
                        <p class="color-gray mb-0">Slip gaji periode terpilih dibuat setelah panen selesai dan bagi hasil tiap kandang dihitung.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Slip gaji dibuat per periode. Halaman ini terisi setelah periode pertama dibuat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="pilihKandang" teks="Memuat slip gaji" cepat />
</div>
