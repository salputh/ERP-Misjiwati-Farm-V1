<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekap hasil sampel bobot ayam" :jejak="['Produksi', 'Sampling bobot']">
            @if ($this->terpilih && ! $this->periode->tertutup())
                <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-sampling">Tambah sampling {{ $this->terpilih->kandang->nama }}</x-tombol.kepala>
            @endif
        </x-breadcrumb>
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->terpilih)
            {{-- Ringkasan semua kandang: sesi terakhir tiap kandang --}}
            <div class="col-12 mb-4">
                <x-kartu judul="Ringkasan sampling" subjudul="Sesi terakhir tiap kandang dalam periode ini." badan="p-0">
                    <div class="tabel-data">
                        <x-sampling.ringkasan-kandang :gabungan="$this->gabunganKandang" />
                    </div>
                </x-kartu>
            </div>

            <x-modal
                id="modal-form-sampling"
                :judul="$sesiId ? 'Ubah sampling '.$this->terpilih->kandang->nama.' '.$this->labelTanggal : 'Tambah sampling '.$this->terpilih->kandang->nama"
                ukuran="xl"
                aksi-tutup="batal"
                x-on:tutup-modal-sampling.window="bootstrap.Modal.getInstance($el)?.hide()">
                {{-- Pengaturan sesi: kandang mengikuti pilihan di halaman; tanggal hanya dapat dipilih saat menambah --}}
                <div class="d-flex flex-wrap align-items-end gap-4 mb-3">
                    <x-info.butir label="Kandang">{{ $this->terpilih->kandang->nama }}</x-info.butir>
                    @if ($sesiId)
                        <x-info.butir label="Tanggal">{{ $this->labelTanggal }}</x-info.butir>
                    @else
                        <div>
                            <span class="d-block text-body-secondary small mb-1">Tanggal</span>
                            <x-pilih-tanggal
                                id="sampling-tanggal"
                                :nilai="$tanggal"
                                :min="$this->batasTanggal['min']"
                                :maks="$this->batasTanggal['maks']"
                                :kesalahan="$errors->has('tanggal')"
                                x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)"
                            />
                        </div>
                    @endif
                    <x-info.butir label="Usia">{{ $this->umur }} hari</x-info.butir>
                    <div>
                        <span class="d-block text-body-secondary small mb-1" id="label-jenis-sampling">Jenis sampling</span>
                        <div class="btn-group" role="group" aria-labelledby="label-jenis-sampling">
                            <button type="button" wire:click="pilihJenis(false)" @class(['btn btn-sm', 'btn-primary' => ! $denganSexing, 'btn-light' => $denganSexing]) aria-pressed="{{ $denganSexing ? 'false' : 'true' }}">Tanpa sexing</button>
                            <button type="button" wire:click="pilihJenis(true)" @class(['btn btn-sm', 'btn-primary' => $denganSexing, 'btn-light' => ! $denganSexing]) aria-pressed="{{ $denganSexing ? 'true' : 'false' }}">Dengan sexing</button>
                        </div>
                    </div>
                    @foreach ($this->hasil['kelamin'] as $kelamin)
                        <div wire:key="ekor-{{ $kelamin }}">
                            <label for="ekor-sampel-{{ $kelamin }}" class="d-block text-body-secondary small mb-1">Ekor per sampel{{ $kelamin === 'campuran' ? '' : ' '.$kelamin }}</label>
                            <input id="ekor-sampel-{{ $kelamin }}" type="number" min="1" step="1" @class(['form-control form-control-sm    px-3 input-ekor', 'is-invalid' => $errors->has('ekor.'.$kelamin)]) wire:model.blur="ekor.{{ $kelamin }}" @disabled($ekorTerkunci)>
                        </div>
                    @endforeach
                    <div>
                        @if ($ekorTerkunci)
                            <x-tombol warna="light" variasi="outlined" ikon="bi-lock" wire:click="bukaKunciEkor" wire:loading.attr="disabled" wire:target="bukaKunciEkor, kunciEkor" aria-label="Buka kunci ekor per sampel">Buka kunci</x-tombol>
                        @else
                            <x-tombol ikon="bi-unlock" wire:click="kunciEkor" wire:loading.attr="disabled" wire:target="ekor, kunciEkor" aria-label="Kunci ekor per sampel">Kunci</x-tombol>
                        @endif
                    </div>
                </div>
                @error('tanggal')
                    <x-peringatan warna="warning" class="mb-3">{{ $message }}</x-peringatan>
                @enderror
                <p class="small text-body-secondary mb-4">
                    @if ($sesiId)
                        Kandang dan tanggal sesi ini tidak dapat diganti. Bila tanggalnya salah, hapus sesi ini dari Riwayat sampling lalu tambah sampling di tanggal yang benar.
                    @else
                        Tanggal yang sudah punya sesi tidak dapat dipakai lagi; ubah sesi itu dari Riwayat sampling.
                    @endif
                    Mulai umur {{ config('sampling.umur_mulai_sexing') }} hari sampel dipisah jantan dan betina. Kolom Ekor di tabel terkunci dan selalu mengikuti Ekor per sampel, supaya setiap titik ditimbang dengan jumlah ekor yang sama. Tekan Kunci setelah angka ekor per sampel benar, agar tidak berubah tanpa sengaja.
                </p>

                {{-- Isian per lantai --}}
                @foreach ($this->susunanLantai() as $lantai => $info)
                    <section class="card basalt-box db-card bg-transparent mb-4" wire:key="lantai-{{ $lantai }}-{{ $denganSexing ? 'sexing' : 'campuran' }}">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">{{ $info['label'] }}</h2></div>
</header>
                            <div class="row g-4">
                                @foreach ($this->hasil['kelamin'] as $kelamin)
                                    <div class="col-12">
                                        @if ($denganSexing)
                                            <x-sampling.kelamin :kelamin="$kelamin" />
                                        @endif
                                        <div class="table-responsive">
                                            <x-sampling.tabel :lantai="$lantai" :kelamin="$kelamin" :kelompok="$this->hasil['lantai'][$lantai][$kelamin]" />
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        
</div>
</section>
                @endforeach

                {{-- Ringkasan --}}
                <section class="card basalt-box db-card bg-transparent">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Ringkasan hasil</h2></div>
</header>
                        <x-sampling.ringkasan :hasil="$this->hasil" :pakan="$this->pakan" :dengan-sexing="$denganSexing" :umur="$this->umur" />
                        <p class="small text-body-secondary mt-3 mb-0">ABW sesi ini menjadi ABW aktual di recording harian tanggal yang sama, tanpa perlu disalin manual.</p>
                    
</div>
</section>

                <x-slot:footer>
                    @if ($errors->any())
                        <span class="text-danger me-auto" role="alert">Lengkapi ekor per sampel dan semua berat sampel sebelum menyimpan ({{ $errors->count() }} isian belum benar).</span>
                    @endif
                    <x-tombol.batal wire:click="batal" />
                    @if ($sesiId)
                        <x-tombol wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-sampling" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
                    @else
                        <x-tombol wire:key="tombol-simpan-baru" wire:click="simpan" wire:loading.attr="disabled" wire:target="simpan, tanggal">Simpan sampling</x-tombol>
                    @endif
                </x-slot:footer>
            </x-modal>

            {{-- Riwayat sampling kandang terpilih: lihat, ubah, hapus --}}
            <div class="col-12 mb-4">
                <section class="card basalt-box db-card">
<div class="db-card-body db-card-body-table">
<header class="db-card-head">
<div>
                            <h2 class="db-card-title">Riwayat sampling</h2>
                            <span class="d-block small text-body-secondary fw-normal tanpa-kapital">Satu sesi per kandang per tanggal. Pilih kandang untuk melihat dan mengelola sesinya.</span>
                        </div>
                        <x-pilih nama="Pilih kandang" :label="$this->terpilih->kandang->nama">
                            @foreach ($this->daftarKandang as $pilihan)
                                <button type="button" wire:key="pilih-kandang-{{ $pilihan->id }}" wire:click="pilihKandang({{ $pilihan->id }})" @class(['dropdown-item', 'active' => $pilihan->is($this->terpilih)])>{{ $pilihan->kandang->nama }}</button>
                            @endforeach
                        </x-pilih>
</header>
                        <div class="tabel-data">
                            <div class="table-responsive">
                                <table class="table mb-0 db-table tabel-riwayat">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Jenis</th>
                                            <th class="text-end">Ekor</th>
                                            <th class="text-end">ABW</th>
                                            <th class="text-end">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @forelse ($this->riwayat as $sesi)
                                            <tr wire:key="riwayat-{{ $sesi->id }}">
                                                <td class="riwayat-tanggal">
                                                    <span class="d-block fw-medium text-body">{{ $sesi->tanggal->translatedFormat('j M Y') }}</span>
                                                    <span class="d-block small text-body-secondary">usia {{ $sesi->umur }} hari</span>
                                                </td>
                                                <td class="riwayat-jenis">
                                                    <span @class(['badge  m-0', 'bg-primary-subtle text-primary' => $sesi->dengan_sexing, 'bg-success-subtle text-success' => ! $sesi->dengan_sexing])>{{ $sesi->dengan_sexing ? 'Dengan sexing' : 'Tanpa sexing' }}</span>
                                                </td>
                                                <td class="text-end riwayat-ekor" data-label="Ekor">@angka($sesi->titik->sum('ekor'))</td>
                                                <td class="text-end riwayat-abw" data-label="ABW">
                                                    <span class="d-block text-body">@angka($sesi->abw()) g</span>
                                                    @if ($sesi->dengan_sexing)
                                                        <span class="d-block small text-body-secondary">J @angka($sesi->abw('jantan')) / B @angka($sesi->abw('betina'))</span>
                                                    @endif
                                                </td>
                                                <td class="riwayat-aksi">
                                                    @if ($this->periode->tertutup())
                                                        <x-aksi.ikon :aksi="[
                                                            ['kelas' => 'view', 'label' => 'Lihat sampling '.$sesi->tanggal->translatedFormat('j F Y'), 'click' => 'buka('.$sesi->id.')', 'modal' => '#modal-riwayat-sampling'],
                                                        ]" />
                                                    @else
                                                        <x-aksi.ikon :aksi="[
                                                            ['kelas' => 'view', 'label' => 'Lihat sampling '.$sesi->tanggal->translatedFormat('j F Y'), 'click' => 'buka('.$sesi->id.')', 'modal' => '#modal-riwayat-sampling'],
                                                            ['kelas' => 'edit', 'label' => 'Ubah sampling '.$sesi->tanggal->translatedFormat('j F Y'), 'click' => 'ubah('.$sesi->id.')', 'modal' => '#modal-form-sampling'],
                                                            ['kelas' => 'remove', 'label' => 'Hapus sampling '.$sesi->tanggal->translatedFormat('j F Y'), 'click' => 'mintaHapus('.$sesi->id.')', 'modal' => '#konfirmasi-hapus-sampling'],
                                                        ]" />
                                                    @endif
                                                </td>
                                            </tr>
                                        @empty
                                            <tr class="riwayat-kosong">
                                                <td colspan="5" class="text-center text-body-secondary">Belum ada sampling tersimpan untuk {{ $this->terpilih->kandang->nama }}.</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    
</div>
</section>
            </div>
        @else
            <x-kosong judul="Belum ada kandang untuk disampling">Sampling bobot bisa diisi setelah periode dibuat dan kandangnya diisi populasi awal.</x-kosong>
        @endif
    </div>

    @if ($this->terpilih)
        @if ($sesiId)
            <x-konfirmasi id="konfirmasi-simpan-sampling" judul="Simpan perubahan sampling {{ $this->labelTanggal }}?" aksi="simpan" tombol="Ya, simpan">
                Sampel sampling {{ $this->terpilih->kandang->nama }} tanggal ini diganti dengan isian form. ABW recording harian tanggal itu ikut berubah.
            </x-konfirmasi>
        @endif

        <x-konfirmasi id="konfirmasi-hapus-sampling" judul="Hapus sampling?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
            Sampling {{ $labelHapus ?: 'ini' }} dihapus permanen beserta seluruh sampelnya. ABW recording harian tanggal itu tidak lagi diambil dari sesi ini.
        </x-konfirmasi>

        <x-memuat target="simpan" teks="Menyimpan sampling" />
        <x-memuat target="hapus" teks="Menghapus sampling" />
        <x-memuat target="pilihKandang, tanggal" teks="Memuat data sampling" cepat />

        <x-sampling.modal-riwayat
            :kandang="$this->terpilih->kandang->nama"
            :sesi="$this->dilihat['sesi'] ?? null"
            :ekor="$this->dilihat['ekor'] ?? []"
            :hasil="$this->dilihat['hasil'] ?? []"
            :pakan="$this->dilihat['pakan'] ?? []"
            :lembar="$this->dilihat['lembar'] ?? null"
        />
    @endif
</div>
