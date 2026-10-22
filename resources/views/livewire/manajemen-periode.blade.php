<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Periode dan kandang" :jejak="['Periode', 'Periode dan kandang']">
            <x-tombol ukuran="sm" variasi="outlined" wire:click="tambahFarm" data-bs-toggle="modal" data-bs-target="#modal-farm">
                Tambah farm
            </x-tombol>
            <x-tombol ukuran="sm" wire:click="tambahPeriode" data-bs-toggle="modal" data-bs-target="#modal-periode" wire:loading.attr="disabled" wire:target="tambahPeriode, simpanPeriode">
                Buat periode
            </x-tombol>
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-lg-12">
                <x-peringatan warna="success" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        <div class="col-xxl-3 col-lg-4 mb-25">
            <div class="card border-0 px-20">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Daftar periode</h6>
                        <span class="fs-12 color-gray">{{ $this->farmTerpilih?->nama }} · {{ $this->daftarPeriode->count() }} periode</span>
                    </div>
                </div>
                <div class="card-body px-0 pt-0">
                    @forelse ($this->daftarPeriode as $periode)
                        @php($aktif = $this->periodeTerpilih?->id === $periode->id)
                        @php($docPeriode = (int) $periode->kandang_periode_sum_populasi_awal + (int) $periode->kandang_periode_sum_bonus_doc_ekor)
                        <button
                            type="button"
                            wire:click="pilihPeriode({{ $periode->id }})"
                            wire:key="periode-{{ $periode->id }}"
                            wire:loading.attr="disabled"
                            wire:target="pilihPeriode"
                            @class(['periode-pilihan w-100 text-start mb-10', 'periode-pilihan--aktif' => $aktif])>
                            <span class="d-flex align-items-center justify-content-between gap-2">
                                <strong>{{ $periode->nama }}</strong>
                                <span @class(['dm-tag m-0', 'tag-success' => in_array($periode->status, ['berjalan', 'aktif'], true), 'tag-info' => ! in_array($periode->status, ['berjalan', 'aktif'], true)])>
                                    {{ ['persiapan' => 'Persiapan', 'berjalan' => 'Berjalan', 'panen' => 'Panen', 'tutup_rhpp' => 'Tutup RHPP', 'aktif' => 'Berjalan', 'selesai' => 'Tutup RHPP'][$periode->status] ?? $periode->status }}
                                </span>
                            </span>
                            <span class="fs-12 color-gray d-block mt-5">
                                Siklus {{ $periode->nomor_siklus ?? '-' }} · {{ $periode->kandang_periode_count }} kandang
                            </span>
                            <span class="fs-12 color-gray d-block">
                                DOC chick-in @angka($docPeriode) ekor
                                @if ($aktif)
                                    · sedang dikerjakan
                                @endif
                            </span>
                        </button>
                    @empty
                        <div class="text-center py-30">
                            <span class="uil uil-calendar-slash fs-30 color-gray"></span>
                            <p class="color-gray mt-10 mb-0">Belum ada periode.</p>
                        </div>
                    @endforelse
                </div>
            </div>

            <div class="card border-0 px-20 mt-20">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Kandang farm</h6>
                        <span class="fs-12 color-gray">{{ $this->daftarKandang->count() }} kandang · @angka($this->daftarKandang->sum('kapasitas')) ekor kapasitas</span>
                    </div>
                    <x-tombol ukuran="xs" wire:click="tambahKandangMaster" data-bs-toggle="modal" data-bs-target="#modal-kandang-master" wire:loading.attr="disabled" wire:target="tambahKandangMaster, simpanKandangMaster">
                        Tambah
                    </x-tombol>
                </div>
                <div class="card-body px-0 pt-0">
                    @forelse ($this->daftarKandang as $kandang)
                        <div class="periode-kandang-farm" wire:key="kandang-master-{{ $kandang->id }}">
                            <div>
                                <strong>{{ $kandang->nama }}</strong>
                                <span class="fs-12 color-gray d-block">
                                    Kapasitas @angka($kandang->kapasitas) ekor
                                    @if ($kandang->periode_kandang_count > 0)
                                        · dipakai di {{ $kandang->periode_kandang_count }} periode
                                    @endif
                                </span>
                            </div>
                            <div class="d-flex gap-2">
                                <x-aksi.ikon :aksi="[
                                    ['kelas' => 'edit', 'label' => 'Ubah kandang '.$kandang->nama, 'click' => 'ubahKandangMaster('.$kandang->id.')', 'modal' => '#modal-kandang-master'],
                                    ['kelas' => 'remove', 'label' => 'Hapus kandang '.$kandang->nama, 'click' => 'mintaHapusKandangMaster('.$kandang->id.')', 'modal' => '#konfirmasi-hapus-kandang-master'],
                                ]" />
                            </div>
                        </div>
                    @empty
                        <div class="text-center py-20">
                            <span class="uil uil-home fs-25 color-gray"></span>
                            <p class="color-gray mt-10 mb-0">Belum ada kandang di farm ini.</p>
                        </div>
                    @endforelse
                </div>
            </div>

            @if ($this->periodeTerpilih)
                @php($gabungan = $this->ringkasanGabungan)
                <div class="card border-0 px-20 mt-20">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Farm / Gabungan</h6>
                            <span class="fs-12 color-gray">{{ $this->periodeTerpilih->nama }}</span>
                        </div>
                    </div>
                    <div class="card-body px-0 pt-0">
                        <div class="periode-gabungan__angka">
                            <span>Populasi chick-in</span>
                            <strong>@angka($this->periodeTerpilih->totalDocChickIn()) ekor</strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>Kandang berjalan</span>
                            <strong>{{ $this->periodeTerpilih->kandangPeriode->count() }} kandang</strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>Pakan diberikan</span>
                            <strong>@angka($gabungan['pakan']['terpakai']) zak</strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>Stok gudang tercatat</span>
                            <strong>{{ $gabungan['pakan']['sisa'] === null ? 'Belum tersedia' : number_format($gabungan['pakan']['sisa'], 1, ',', '.').' zak' }}</strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>Panen gabungan</span>
                            <strong>
                                @if ($gabungan['panen'])
                                    @angka($gabungan['panen']['total']['ekor']) ekor
                                @else
                                    Belum ada panen
                                @endif
                            </strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>RHPP resmi</span>
                            <strong>
                                {{ $gabungan['rhpp'] ? 'Rp '.number_format($gabungan['rhpp']['rekap']['bersih'], 0, ',', '.') : 'Belum tersedia' }}
                            </strong>
                        </div>
                        <div class="periode-gabungan__angka">
                            <span>Biaya bersama</span>
                            <strong class="fs-12">Belum ada ledger level farm</strong>
                        </div>
                        <a class="btn btn-outline-primary btn-sm btn-squared w-100 mt-15" href="{{ route('dashboard', ['periode' => $this->periodeTerpilih->id]) }}">
                            Lihat ringkasan gabungan
                        </a>
                    </div>
                </div>
            @endif
        </div>

        <div class="col-xxl-9 col-lg-8 mb-25">
            @if ($this->periodeTerpilih)
                @php($periode = $this->periodeTerpilih)
                @php($totalDoc = $periode->totalDocChickIn())
                @php($umurAyam = $periode->umurPada(today()))
                @php($beratDoc = $periode->kandangPeriode->map(fn ($satu) => $satu->beratDocGramEfektif())->filter()->unique())
                <div class="card border-0 px-25 mb-25">
                    <div class="d-flex card-header px-0 border-0">
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap pt-3">
                                <h5 class="mb-0">{{ $periode->nama }}</h5>
                                <span class="dm-tag tag-primary">Periode aktif</span>
                                <span @class(['dm-tag', 'tag-success' => in_array($periode->status, ['berjalan', 'aktif'], true), 'tag-info' => ! in_array($periode->status, ['berjalan', 'aktif'], true)])>
                                    {{ ['persiapan' => 'Persiapan', 'berjalan' => 'Berjalan', 'panen' => 'Panen', 'tutup_rhpp' => 'Tutup RHPP', 'aktif' => 'Berjalan', 'selesai' => 'Tutup RHPP'][$periode->status] ?? $periode->status }}
                                </span>
                            </div>
                            <span class="fs-12 color-gray d-block mt-5">
                                Siklus {{ $periode->nomor_siklus ?? 'belum ditetapkan' }} · Inti {{ $periode->inti ?: 'belum ditetapkan' }} · PPL {{ $periode->ppl ?: 'belum ditetapkan' }}
                            </span>
                            <span class="fs-12 color-gray d-block mt-5">
                                Chick-in {{ $periode->tanggal_chick_in->translatedFormat('j M Y') }}
                                · umur {{ $umurAyam }} hari
                                · standar {{ $periode->strain }}
                                · DOC {{ $periode->berat_doc_gram }} gram
                            </span>
                        </div>
                        <div class="card-extra d-flex gap-2 flex-wrap">
                            @unless ($periode->tertutup())
                                <x-aksi.ikon :aksi="[
                                    ['kelas' => 'edit', 'label' => 'Ubah periode '.$periode->nama, 'click' => 'ubahPeriode('.$periode->id.')', 'modal' => '#modal-periode'],
                                    ['kelas' => 'remove', 'label' => 'Hapus periode '.$periode->nama, 'click' => 'mintaHapusPeriode('.$periode->id.')', 'modal' => '#konfirmasi-hapus-periode'],
                                ]" />
                            @else
                                <span class="dm-tag tag-info align-self-center">Tutup RHPP · baca saja</span>
                            @endunless
                        </div>
                    </div>
                    <div class="card-body px-0 pt-0">
                        <div class="row">
                            <div class="col-sm-6 col-xl-3 mb-15">
                                <div class="periode-ringkas">
                                    <span>Kandang</span>
                                    <strong>{{ $periode->kandangPeriode->count() }}</strong>
                                </div>
                            </div>
                            <div class="col-sm-6 col-xl-3 mb-15">
                                <div class="periode-ringkas">
                                    <span>DOC chick-in</span>
                                    <strong>@angka($totalDoc) ekor</strong>
                                </div>
                            </div>
                            <div class="col-sm-6 col-xl-3 mb-15">
                                <div class="periode-ringkas">
                                    <span>Berat DOC</span>
                                    <strong>
                                        @if ($beratDoc->count() === 1)
                                            {{ $beratDoc->first() }} gram
                                        @elseif ($beratDoc->isEmpty())
                                            -
                                        @else
                                            Bervariasi
                                        @endif
                                    </strong>
                                </div>
                            </div>
                            <div class="col-sm-6 col-xl-3 mb-15">
                                <div class="periode-ringkas">
                                    <span>Umur ayam</span>
                                    <strong>{{ $umurAyam }} hari</strong>
                                </div>
                            </div>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <a class="btn btn-primary btn-sm btn-squared" href="{{ route('laporan.harian', ['periode' => $periode->id]) }}">Laporan harian</a>
                            <a class="btn btn-outline-primary btn-sm btn-squared" href="{{ route('rhpp', ['periode' => $periode->id]) }}">RHPP</a>
                            <a class="btn btn-outline-primary btn-sm btn-squared" href="{{ route('panen.rekap', ['periode' => $periode->id]) }}">Panen</a>
                            <a class="btn btn-outline-primary btn-sm btn-squared" href="{{ route('payroll.pemanen', ['periode' => $periode->id]) }}">Payroll pemanen</a>
                            <a class="btn btn-outline-primary btn-sm btn-squared" href="{{ route('pakan.log', ['periode' => $periode->id]) }}">Pakan dan stok</a>
                        </div>
                    </div>
                </div>

                <div class="card border-0 px-25 mb-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6 id="daftar-kandang">Kandang pada periode</h6>
                            <span class="fs-12 color-gray">Populasi awal tidak boleh melebihi kapasitas kandang.</span>
                        </div>
                        @unless ($periode->tertutup())
                            <x-tombol ukuran="sm" wire:click="tambahKandang" data-bs-toggle="modal" data-bs-target="#modal-kandang-periode" wire:loading.attr="disabled" wire:target="tambahKandang, simpanKandang">
                                Tambah kandang
                            </x-tombol>
                        @endunless
                    </div>
                    <div class="card-body px-0 pt-0">
                        @forelse ($periode->kandangPeriode->sortBy('kandang.nama') as $periodeKandang)
                            <div class="periode-kandang mb-15" wire:key="periode-kandang-{{ $periodeKandang->id }}">
                                <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
                                    <div>
                                        <h6 class="mb-5">{{ $periodeKandang->kandang->nama }}</h6>
                                        <span class="fs-12 color-gray">
                                            Populasi administratif @angka($periodeKandang->populasi_awal)
                                            @if ($periodeKandang->bonus_doc_ekor)
                                                + bonus DOC @angka($periodeKandang->bonus_doc_ekor)
                                            @endif
                                            = @angka($periodeKandang->populasiAktual()) / kapasitas @angka($periodeKandang->kandang->kapasitas) ekor
                                        </span>
                                        <span class="fs-12 color-gray d-block mt-5">
                                            Chick-in {{ $periodeKandang->tanggalChickInEfektif()->translatedFormat('j M Y') }}
                                            · DOC {{ $periodeKandang->beratDocGramEfektif() }} gram
                                            · Harga DOC {{ $periodeKandang->harga_doc_per_ekor === null ? 'belum dicatat' : 'Rp '.number_format($periodeKandang->harga_doc_per_ekor, 0, ',', '.').'/ekor' }}
                                        </span>
                                        <div class="fs-12 color-gray mt-5">
                                            Controller: {{ $periodeKandang->bagiHasil?->controller ?: 'belum ditetapkan' }}
                                            @if ($periodeKandang->bagiHasil?->terkunci())
                                                · <span class="color-warning fw-500">lembar bagi hasil terkunci</span>
                                            @endif
                                        </div>
                                        <div class="fs-12 color-gray mt-5">
                                            Karyawan kandang:
                                            @if ($periodeKandang->kandang->karyawan->isNotEmpty())
                                                {{ $periodeKandang->kandang->karyawan->map(fn ($karyawan) => $karyawan->nama.' ('.$karyawan->jabatan->label().')')->join(', ') }}
                                            @else
                                                belum ditetapkan
                                            @endif
                                            · <a href="{{ route('karyawan') }}">Kelola karyawan</a>
                                        </div>
                                    </div>
                                    <div class="d-flex gap-2 flex-wrap">
                                        @if ($periodeKandang->bagiHasil?->terkunci())
                                            <x-tombol ukuran="xs" variasi="outlined" wire:click="bukaModalBukaKunciBagiHasil({{ $periodeKandang->id }})" data-bs-toggle="modal" data-bs-target="#modal-buka-kunci-bagi-hasil" wire:loading.attr="disabled" wire:target="bukaModalBukaKunciBagiHasil, bukaKunciBagiHasil">
                                                Buka kunci bagi hasil
                                            </x-tombol>
                                        @endif
                                        @unless ($periode->tertutup())
                                            <x-aksi.ikon :aksi="[
                                                ['kelas' => 'edit', 'label' => 'Ubah kandang '.$periodeKandang->kandang->nama.' di periode ini', 'click' => 'ubahKandang('.$periodeKandang->id.')', 'modal' => '#modal-kandang-periode'],
                                                ['kelas' => 'remove', 'label' => 'Lepas kandang '.$periodeKandang->kandang->nama.' dari periode ini', 'click' => 'mintaHapusKandang('.$periodeKandang->id.')', 'modal' => '#konfirmasi-hapus-kandang-periode'],
                                            ]" />
                                        @endunless
                                    </div>
                                </div>

                                <div class="periode-modul mt-15">
                                    <a href="{{ route('recording.harian', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">
                                        <strong>Recording harian</strong><span>{{ $periodeKandang->recordings->count() }} hari</span>
                                    </a>
                                    <a href="{{ route('pakan.log', ['periode' => $periode->id]) }}">
                                        <strong>Pakan dan stok</strong><span>{{ $periodeKandang->pemberianPakan->count() }} pemberian</span>
                                    </a>
                                    <a href="{{ route('sampling.bobot', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">
                                        <strong>Sampling bobot</strong><span>{{ $periodeKandang->sesiSampling->count() }} sesi</span>
                                    </a>
                                    <a href="{{ route('panen.rekap', ['periode' => $periode->id]) }}">
                                        <strong>Panen</strong><span>{{ $periode->notaPanen->count() }} nota</span>
                                    </a>
                                    <a href="{{ route('kas.operasional', ['kandang' => $periodeKandang->kandang_id, 'periode' => $periode->id]) }}">
                                        <strong>Kas operasional</strong><span>{{ $periodeKandang->transaksiKas->count() }} transaksi</span>
                                    </a>
                                    <a href="{{ route('bagi.hasil', ['kandang' => $periodeKandang->kandang_id, 'periode' => $periode->id]) }}">
                                        <strong>Bagi hasil</strong><span>{{ $periodeKandang->bagiHasil ? 'sudah diatur' : 'belum diatur' }}</span>
                                    </a>
                                    <a href="{{ route('payroll.abk', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">
                                        <strong>Payroll ABK</strong><span>{{ $periodeKandang->slipGaji->count() }} slip</span>
                                    </a>
                                </div>
                            </div>
                        @empty
                            <div class="text-center py-30">
                                <span class="uil uil-home fs-30 color-gray"></span>
                                <p class="color-gray mt-10 mb-0">Belum ada kandang untuk periode ini. Tambahkan kandang agar pencatatan produksi dan keuangan bisa dimulai.</p>
                            </div>
                        @endforelse

                        @if ($periode->kandangPeriode->isNotEmpty())
                            <div class="periode-total">
                                <span>Total DOC chick-in periode ini</span>
                                <strong>@angka($totalDoc) ekor</strong>
                            </div>
                        @endif
                    </div>
                </div>

                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Master data dan kesiapan periode</h6>
                            <span class="fs-12 color-gray">Acuan sebelum pencatatan transaksi dan perhitungan keuangan.</span>
                        </div>
                    </div>
                    <div class="card-body px-0 pt-0">
                        <div class="row">
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('modul', ['grup' => 'master', 'slug' => 'standar-strain']) }}">
                                    <strong>Standar strain</strong>
                                    <span>{{ count($this->masterData['standar']) }} standar tersedia · ABW, DG, pakan per umur</span>
                                </a>
                            </div>
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('master-data') }}">
                                    <strong>Jenis pakan</strong>
                                    <span>{{ $this->masterData['pakan']->count() }} jenis · harga/kg dan berat/zak</span>
                                </a>
                            </div>
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('master-data', ['periode' => $periode->id]) }}">
                                    <strong>Harga kontrak</strong>
                                    <span>{{ $this->masterData['harga']->count() }} bracket berat untuk periode ini</span>
                                </a>
                            </div>
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('karyawan') }}">
                                    <strong>Karyawan dan controller kandang</strong>
                                    <span>{{ $this->masterData['karyawan']->count() }} karyawan · ditugaskan per kandang</span>
                                </a>
                            </div>
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('master-data') }}">
                                    <strong>Pemodal</strong>
                                    <span>{{ $this->masterData['pemodal']->count() }} pemodal terdaftar</span>
                                </a>
                            </div>
                            <div class="col-md-6 col-xl-4 mb-15">
                                <a class="periode-master" href="{{ route('modul', ['grup' => 'master', 'slug' => 'tarif-periode']) }}">
                                    <strong>Tarif periode</strong>
                                    <span>Gaji/kg, premi, bonus, dan zakat</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            @else
                <div class="card border-0">
                    <div class="card-body p-40 text-center">
                        <span class="uil uil-calendar-slash fs-40 color-gray"></span>
                        <h5 class="mt-15 mb-10">Mulai dengan membuat periode</h5>
                        <p class="color-gray mb-20">Periode menjadi akar data chick-in, standar DOC, dan kandang. Semua pencatatan produksi serta keuangan selanjutnya mengikuti periode dan kandangnya.</p>
                        <x-tombol wire:click="tambahPeriode" data-bs-toggle="modal" data-bs-target="#modal-periode">Buat periode pertama</x-tombol>
                    </div>
                </div>
            @endif
        </div>
    </div>

    <x-modal
        id="modal-farm"
        judul="Tambah farm"
        x-on:tutup-modal-farm.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanFarm">
        
            <div class="row">
                <div class="col-md-8">
                    <x-masukan id="farm-nama" label="Nama farm" maxlength="150" wire:model="namaFarm" :kesalahan="$errors->first('namaFarm')" placeholder="Contoh: Misjiwati Farm" />
                </div>
                <div class="col-md-4">
                    <x-masukan id="farm-kode" label="Kode farm (opsional)" maxlength="40" wire:model="kodeFarm" :kesalahan="$errors->first('kodeFarm')" placeholder="Contoh: K0242" />
                </div>
            </div>
            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="tambahFarm">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanFarm">Simpan farm</x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-periode"
        :judul="$periodeFormId ? 'Ubah periode' : 'Buat periode'"
        x-on:tutup-modal-periode.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanPeriode">
        
            <p class="fs-12 color-gray">{{ $this->farmTerpilih?->nama }}</p>
            <div class="row">
                <div class="col-md-6">
                    <x-masukan id="periode-nama" label="Nama periode" maxlength="150" wire:model="nama" :kesalahan="$errors->first('nama')" placeholder="Contoh: Periode Oktober 2026" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-nomor-siklus" label="Nomor siklus" tipe="number" min="1" max="65535" step="1" wire:model="nomorSiklus" :kesalahan="$errors->first('nomorSiklus')" placeholder="Contoh: 18" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-inti" label="Inti" maxlength="150" wire:model="inti" :kesalahan="$errors->first('inti')" placeholder="Contoh: PT. Indojaya Agrinusa" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-ppl" label="PPL" maxlength="150" wire:model="ppl" :kesalahan="$errors->first('ppl')" placeholder="Nama PPL" />
                </div>
                <div class="col-md-6">
                    <label for="periode-strain" class="il-gray fs-14 fw-500 mb-10">Standar strain</label>
                    <select id="periode-strain" wire:model="strain" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('strain')])>
                        <option value="">Pilih standar strain</option>
                        @foreach (array_keys(config('standar.strain', [])) as $strainPilihan)
                            <option value="{{ $strainPilihan }}">{{ $strainPilihan }}</option>
                        @endforeach
                    </select>
                    @error('strain')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="col-md-6">
                    <label for="periode-status" class="il-gray fs-14 fw-500 mb-10">Status</label>
                    <select id="periode-status" wire:model="status" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('status')])>
                        <option value="persiapan">Persiapan</option>
                        <option value="berjalan">Berjalan</option>
                        <option value="panen">Panen</option>
                        <option value="tutup_rhpp">Tutup RHPP</option>
                    </select>
                    @error('status')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-chick-in" label="Tanggal chick-in" tipe="date" wire:model="tanggalChickIn" :kesalahan="$errors->first('tanggalChickIn')" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="periode-berat-doc" label="Berat DOC (gram)" tipe="number" min="1" max="1000" step="1" wire:model="beratDocGram" :kesalahan="$errors->first('beratDocGram')" />
                </div>
                <div class="col-md-6">
                    <x-masukan
                        id="periode-jumlah-doc"
                        label="Jumlah DOC chick-in (ekor)"
                        tipe="number"
                        min="1"
                        max="1000000"
                        step="1"
                        wire:model="jumlahDocChickIn"
                        :kesalahan="$errors->first('jumlahDocChickIn')"
                        :keterangan="! $periodeFormId || $this->periodeTerpilih?->kandangPeriode->isEmpty()
                            ? 'Tambahkan kandang ke periode ini terlebih dahulu.'
                            : 'Total DOC yang masuk pada periode ini. Bila diubah, populasi tiap kandang dibagi ulang sesuai porsinya.'" />
                </div>
                @error('periodeForm')
                    <div class="col-12"><div class="alert alert-danger" role="alert">{{ $message }}</div></div>
                @enderror
            </div>
            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="batalPeriode">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanPeriode">Simpan periode</x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-kandang-master"
        :judul="$kandangMasterFormId ? 'Ubah kandang farm' : 'Tambah kandang farm'"
        x-on:tutup-modal-kandang-master.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanKandangMaster">
        
            <p class="fs-12 color-gray">Kandang induk di farm ini. Kapasitas menjadi batas populasi DOC pada periode yang memakai kandang tersebut.</p>
            <div class="row">
                <div class="col-md-7">
                    <x-masukan id="kandang-master-nama" label="Nama kandang" maxlength="150" wire:model="kandangMasterNama" :kesalahan="$errors->first('kandangMasterNama')" placeholder="Contoh: Kandang 3" />
                </div>
                <div class="col-md-5">
                    <x-masukan id="kandang-master-kapasitas" label="Kapasitas (ekor)" tipe="number" min="1" max="1000000" step="1" wire:model="kandangMasterKapasitas" :kesalahan="$errors->first('kandangMasterKapasitas')" placeholder="Contoh: 20000" />
                </div>
            </div>
            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="tambahKandangMaster">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanKandangMaster">Simpan kandang</x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-modal
        id="modal-kandang-periode"
        :judul="$periodeKandangFormId ? 'Ubah kandang periode' : 'Tambah kandang ke periode'"
        x-on:tutup-modal-kandang-periode.window="bootstrap.Modal.getInstance($el).hide()" submit="simpanKandang">
        
            @if ($periodeKandangFormId && $this->periodeTerpilih?->kandangPeriode->firstWhere('id', $periodeKandangFormId)?->punyaCatatan())
                <div class="alert alert-warning" role="alert">
                    <h6 class="alert-heading">Kandang sudah punya data produksi dan keuangan</h6>
                    <p class="mb-0">Populasi awal, bonus DOC, dan harga DOC masih dapat disesuaikan. Kandang yang dipakai, tanggal chick-in, dan berat DOC terkunci karena sudah menjadi dasar perhitungan laporan.</p>
                </div>
            @endif
            <div class="row">
                <div class="col-md-6 mb-25">
                    <label for="kandang-periode-pilih" class="il-gray fs-14 fw-500 mb-10">Kandang</label>
                    <select id="kandang-periode-pilih" wire:model="kandangId" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('kandangId')])>
                        <option value="">Pilih kandang</option>
                        @foreach ($this->daftarKandang as $kandang)
                            @if (! $this->periodeTerpilih?->kandangPeriode->contains('kandang_id', $kandang->id) || $kandang->id === (int) $kandangId)
                                <option value="{{ $kandang->id }}">{{ $kandang->nama }} · kapasitas @angka($kandang->kapasitas)</option>
                            @endif
                        @endforeach
                    </select>
                    @error('kandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-populasi" label="Populasi awal (ekor)" tipe="number" min="1" max="1000000" step="1" wire:model="populasiAwal" :kesalahan="$errors->first('populasiAwal')" placeholder="Contoh: 26000" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-chick-in" label="Tanggal chick-in" tipe="date" wire:model="tanggalChickInKandang" :kesalahan="$errors->first('tanggalChickInKandang')" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-berat-doc" label="Berat DOC (gram)" tipe="number" min="1" max="1000" step="1" wire:model="beratDocGramKandang" :kesalahan="$errors->first('beratDocGramKandang')" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-harga-doc" label="Harga DOC (Rp/ekor, opsional)" tipe="number" min="0" max="1000000" step="1" wire:model="hargaDocPerEkor" :kesalahan="$errors->first('hargaDocPerEkor')" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="kandang-periode-bonus-doc" label="Bonus DOC (ekor)" tipe="number" min="0" max="1000000" step="1" wire:model="bonusDocEkor" :kesalahan="$errors->first('bonusDocEkor')" />
                </div>
                @error('kandangForm')
                    <div class="col-12"><div class="alert alert-danger" role="alert">{{ $message }}</div></div>
                @enderror
            </div>
            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="batalKandang">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanKandang">Simpan kandang</x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-konfirmasi id="konfirmasi-hapus-periode" judul="Hapus periode {{ $namaPeriodeHapus }}?" aksi="hapusPeriode" tombol="Ya, hapus" warna="danger" memuat="mintaHapusPeriode">
        Periode hanya dapat dihapus jika belum memiliki transaksi. Periode dengan data produksi atau keuangan harus diarsipkan dengan mengubah statusnya menjadi selesai.
        @error('hapusPeriode')<span class="d-block color-danger mt-10">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-kandang-master" judul="Hapus {{ $kandangMasterHapusNama }}?" aksi="hapusKandangMaster" tombol="Ya, hapus" warna="danger" memuat="mintaHapusKandangMaster">
        Kandang hanya dapat dihapus jika belum dipakai pada periode mana pun.
        @error('hapusKandangMaster')<span class="d-block color-danger mt-10">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-kandang-periode" judul="Lepas {{ $namaKandangHapus }} dari periode?" aksi="hapusKandang" tombol="Ya, lepas" warna="danger" memuat="mintaHapusKandang">
        Kandang hanya dapat dilepas jika belum memiliki catatan produksi atau keuangan.
        @error('hapusKandang')<span class="d-block color-danger mt-10">{{ $message }}</span>@enderror
    </x-konfirmasi>

    <x-modal
        id="modal-buka-kunci-bagi-hasil"
        judul="Buka kunci bagi hasil"
        submit="bukaKunciBagiHasil"
        x-on:tutup-modal-buka-kunci-bagi-hasil.window="bootstrap.Modal.getInstance($el).hide()">
        <p class="fs-12 color-gray">Masukkan password admin untuk membuka kembali lembar bagi hasil yang dikunci.</p>
        <x-masukan id="buka-kunci-bagi-hasil-sandi" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
        <x-slot:footer>
            <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal">Batal</x-tombol>
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="bukaKunciBagiHasil">Buka kunci</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-memuat target="simpanPeriode, simpanKandang, hapusPeriode, hapusKandang, simpanKandangMaster, hapusKandangMaster, bukaKunciBagiHasil" teks="Menyimpan data periode" />
</div>
