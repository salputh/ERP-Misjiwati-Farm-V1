<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekap hasil sampel bobot ayam" :jejak="['Produksi', 'Sampling bobot']">
            @if ($this->terpilih && ! $this->periode->tertutup())
                <x-tombol.kepala ikon="las la-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-sampling">Tambah sampling {{ $this->terpilih->kandang->nama }}</x-tombol.kepala>
            @endif
        </x-breadcrumb>
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->terpilih)
            {{-- Ringkasan semua kandang: sesi terakhir tiap kandang --}}
            <div class="col-12 mb-25">
                <x-kartu judul="Ringkasan sampling" subjudul="Sesi terakhir tiap kandang dalam periode ini." badan="p-0">
                    <div class="table4 p-25">
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
                <div class="d-flex flex-wrap align-items-end gap-4 mb-15">
                    <x-info.butir label="Kandang">{{ $this->terpilih->kandang->nama }}</x-info.butir>
                    @if ($sesiId)
                        <x-info.butir label="Tanggal">{{ $this->labelTanggal }}</x-info.butir>
                    @else
                        <div>
                            <span class="d-block color-light fs-12 mb-1">Tanggal</span>
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
                        <span class="d-block color-light fs-12 mb-1" id="label-jenis-sampling">Jenis sampling</span>
                        <div class="btn-group dm-button-group btn-group-normal" role="group" aria-labelledby="label-jenis-sampling">
                            <button type="button" wire:click="pilihJenis(false)" @class(['btn btn-sm', 'btn-primary' => ! $denganSexing, 'btn-light' => $denganSexing]) aria-pressed="{{ $denganSexing ? 'false' : 'true' }}">Tanpa sexing</button>
                            <button type="button" wire:click="pilihJenis(true)" @class(['btn btn-sm', 'btn-primary' => $denganSexing, 'btn-light' => ! $denganSexing]) aria-pressed="{{ $denganSexing ? 'true' : 'false' }}">Dengan sexing</button>
                        </div>
                    </div>
                    @foreach ($this->hasil['kelamin'] as $kelamin)
                        <div wire:key="ekor-{{ $kelamin }}">
                            <label for="ekor-sampel-{{ $kelamin }}" class="d-block color-light fs-12 mb-1">Ekor per sampel{{ $kelamin === 'campuran' ? '' : ' '.$kelamin }}</label>
                            <input id="ekor-sampel-{{ $kelamin }}" type="number" min="1" step="1" @class(['form-control form-control-sm ip-gray radius-xs b-light px-15 input-ekor', 'is-invalid' => $errors->has('ekor.'.$kelamin)]) wire:model.blur="ekor.{{ $kelamin }}" @disabled($ekorTerkunci)>
                        </div>
                    @endforeach
                    <div>
                        @if ($ekorTerkunci)
                            <x-tombol warna="light" variasi="outlined" ikon="uil-lock" wire:click="bukaKunciEkor" wire:loading.attr="disabled" wire:target="bukaKunciEkor, kunciEkor" aria-label="Buka kunci ekor per sampel">Buka kunci</x-tombol>
                        @else
                            <x-tombol ikon="uil-unlock" wire:click="kunciEkor" wire:loading.attr="disabled" wire:target="ekor, kunciEkor" aria-label="Kunci ekor per sampel">Kunci</x-tombol>
                        @endif
                    </div>
                </div>
                @error('tanggal')
                    <x-peringatan warna="warning" class="mb-15">{{ $message }}</x-peringatan>
                @enderror
                <p class="fs-13 color-light mb-25">
                    @if ($sesiId)
                        Kandang dan tanggal sesi ini tidak dapat diganti. Bila tanggalnya salah, hapus sesi ini dari Riwayat sampling lalu tambah sampling di tanggal yang benar.
                    @else
                        Tanggal yang sudah punya sesi tidak dapat dipakai lagi; ubah sesi itu dari Riwayat sampling.
                    @endif
                    Mulai umur {{ config('sampling.umur_mulai_sexing') }} hari sampel dipisah jantan dan betina. Kolom Ekor di tabel terkunci dan selalu mengikuti Ekor per sampel, supaya setiap titik ditimbang dengan jumlah ekor yang sama. Tekan Kunci setelah angka ekor per sampel benar, agar tidak berubah tanpa sengaja.
                </p>

                {{-- Isian per lantai --}}
                @foreach (config('sampling.lantai') as $lantai => $info)
                    <div class="card card-default card-sm bg-transparent card-bordered mb-25" wire:key="lantai-{{ $lantai }}-{{ $denganSexing ? 'sexing' : 'campuran' }}">
                        <div class="card-header">
                            <h6>{{ $info['label'] }}</h6>
                        </div>
                        <div class="card-body">
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
                    </div>
                @endforeach

                {{-- Ringkasan --}}
                <div class="card card-default card-sm bg-transparent card-bordered">
                    <div class="card-header">
                        <h6>Ringkasan hasil</h6>
                    </div>
                    <div class="card-body">
                        <x-sampling.ringkasan :hasil="$this->hasil" :pakan="$this->pakan" :dengan-sexing="$denganSexing" :umur="$this->umur" />
                        <p class="fs-13 color-light mt-15 mb-0">ABW sesi ini menjadi ABW aktual di recording harian tanggal yang sama, tanpa perlu disalin manual.</p>
                    </div>
                </div>

                <x-slot:footer>
                    @if ($errors->any())
                        <span class="color-danger fs-14 me-auto" role="alert">Lengkapi ekor per sampel dan semua berat sampel sebelum menyimpan ({{ $errors->count() }} isian belum benar).</span>
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
            <div class="col-12 mb-25">
                <div class="card card-default card-md">
                    <div class="card-header flex-wrap gap-2">
                        <div>
                            <h6>Riwayat sampling</h6>
                            <span class="d-block fs-13 color-light fw-400 tanpa-kapital">Satu sesi per kandang per tanggal. Pilih kandang untuk melihat dan mengelola sesinya.</span>
                        </div>
                        <div class="card-extra">
                            <ul class="card-tab-links nav-tabs nav" role="tablist">
                                @foreach ($this->daftarKandang as $pilihan)
                                    <li wire:key="tab-kandang-{{ $pilihan->id }}">
                                        <a
                                            href="{{ route('sampling.bobot', ['periode' => $this->periode->id, 'kandang' => $pilihan->id]) }}"
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
                    <div class="card-body p-0">
                        <div class="table4 p-25">
                            <div class="table-responsive">
                                <table class="table mb-0">
                                    <thead>
                                        <tr class="userDatatable-header">
                                            <th><span class="userDatatable-title">Tanggal</span></th>
                                            <th><span class="userDatatable-title">Jenis</span></th>
                                            <th class="text-end"><span class="userDatatable-title">Ekor</span></th>
                                            <th class="text-end"><span class="userDatatable-title">ABW</span></th>
                                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @forelse ($this->riwayat as $sesi)
                                            <tr wire:key="riwayat-{{ $sesi->id }}">
                                                <td>
                                                    <span class="d-block fw-500 color-dark">{{ $sesi->tanggal->translatedFormat('j M Y') }}</span>
                                                    <span class="d-block fs-12 color-light">usia {{ $sesi->umur }} hari</span>
                                                </td>
                                                <td>
                                                    <span @class(['dm-tag tag-transparented m-0', 'tag-primary' => $sesi->dengan_sexing, 'tag-success' => ! $sesi->dengan_sexing])>{{ $sesi->dengan_sexing ? 'Dengan sexing' : 'Tanpa sexing' }}</span>
                                                </td>
                                                <td class="text-end">@angka($sesi->titik->sum('ekor'))</td>
                                                <td class="text-end">
                                                    <span class="d-block color-dark">@angka($sesi->abw()) g</span>
                                                    @if ($sesi->dengan_sexing)
                                                        <span class="d-block fs-12 color-light">J @angka($sesi->abw('jantan')) / B @angka($sesi->abw('betina'))</span>
                                                    @endif
                                                </td>
                                                <td>
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
                                            <tr>
                                                <td colspan="5" class="text-center color-light">Belum ada sampling tersimpan untuk {{ $this->terpilih->kandang->nama }}.</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
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
