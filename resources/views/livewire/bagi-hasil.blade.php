<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Bagi hasil {{ $kandang->nama }}" :jejak="['Keuangan', 'Bagi hasil', $kandang->nama]">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="bagi.hasil" :parameter="['kandang' => $kandang->id]" />
        </x-breadcrumb>

        @if ($this->lembar)
            {{-- Identitas lembar --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body">
                        <dl class="recording-info mb-0">
                            <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Periode</dt><dd>{{ $this->periode->nama }}</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $kandang->nama }}</dd></div>
                            <div><dt>Populasi</dt><dd>@angka($this->lembar['identitas']['populasi']) ekor</dd></div>
                            <div><dt>Kg terjual</dt><dd>@angka($this->lembar['identitas']['kg'], 2) kg</dd></div>
                            @isset($this->lembar['identitas']['controller'])
                                <div><dt>Controller</dt><dd>{{ $this->lembar['identitas']['controller'] }}</dd></div>
                            @endisset
                        </dl>
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
                            Angka <span class="recording-masukan">ungu</span> adalah masukan yang disalin dari lembar bagi hasil.
                            @isset($this->lembar['operasional']['kas'])
                                @if ($this->lembar['operasional']['selisih'] === 0)
                                    Operasional sama dengan total pengeluaran di <a href="{{ route('kas.operasional', ['kandang' => $kandang->id, 'periode' => $this->periode->id]) }}">buku kas</a>.
                                @else
                                    <span class="color-warning fw-500">Operasional berbeda dari <a href="{{ route('kas.operasional', ['kandang' => $kandang->id, 'periode' => $this->periode->id]) }}">buku kas</a>, yang mencatat Rp @angka($this->lembar['operasional']['kas']) (selisih Rp @angka(abs($this->lembar['operasional']['selisih']))).</span>
                                @endif
                            @else
                                Buku kas {{ $kandang->nama }} periode ini belum diisi, jadi angka operasional belum bisa dicocokkan.
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
                        <p class="color-gray mb-0">{{ $this->periode->nama }} tidak mencatat chick-in di {{ $kandang->nama }}, jadi tidak ada bagi hasilnya. Pilih periode lain di kanan atas.</p>
                    </div>
                </div>
            </div>
        @elseif (! $this->rhpp)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">RHPP real belum dicatat</h5>
                        <p class="color-gray mb-0">Pendapatan bagi hasil diambil dari RHPP real. Halaman ini terisi setelah dokumen RHPP dari inti untuk {{ $this->periode->nama }} dicatat.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Bagi hasil belum diisi</h5>
                        <p class="color-gray mb-0">Biaya operasional, tarif, dan daftar penerima bagi hasil {{ $kandang->nama }} untuk {{ $this->periode->nama }} belum dicatat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>
</div>
