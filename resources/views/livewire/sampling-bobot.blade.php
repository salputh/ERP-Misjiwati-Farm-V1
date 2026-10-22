<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekap hasil sampel bobot ayam" :jejak="['Produksi', 'Sampling bobot']" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($this->terpilih)
            {{-- Ringkasan kedua kandangs, yang pertama dilihat sebelum masuk ke form sampling --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Ringkasan sampling</h6>
                            <span class="fs-12 color-gray">Sesi terbaru tiap kandangs dalam periode ini.</span>
                        </div>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <x-sampling.ringkasan-kandang :gabungan="$this->gabunganKandang" />
                    </div>
                </div>
            </div>

            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h6 class="mb-5">{{ $sesiId ? 'Ubah sampling tersimpan' : 'Sampling baru' }}</h6>
                            <span class="fs-12 color-gray">{{ $this->terpilih->kandang->nama }} · {{ $this->labelTanggal }} · usia {{ $this->umur }} hari</span>
                        </div>
                        @unless ($this->periode->tertutup())
                            <button type="button" class="btn btn-primary btn-default btn-squared" data-bs-toggle="modal" data-bs-target="#modal-form-sampling">
                                {{ $sesiId ? 'Ubah sampling' : 'Isi sampling' }}
                            </button>
                        @endunless
                    </div>
                </div>
            </div>

            <x-modal
                id="modal-form-sampling"
                :judul="$sesiId ? 'Ubah sampling bobot' : 'Sampling bobot baru'"
                ukuran="xl">
                <div class="row">
            {{-- Pengaturan sesi --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-header border-0">
                        <div class="card-extra fs-14 tanpa-kapital">
                            @if ($pesan)
                                <span class="color-success fw-500" role="status">{{ $pesan }}</span>
                            @elseif ($sesiId)
                                <span class="color-gray">Mengubah sampling yang sudah tersimpan</span>
                            @else
                                <span class="color-gray">Sampling baru</span>
                            @endif
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        <div class="sampling-pengaturan">
                            <div>
                                <span>Kandang</span>
                                <x-pilih :label="$this->terpilih->kandang->nama" nama="Pilih kandang" ukuran="xs">
                                    @foreach ($this->daftarKandang as $pilihan)
                                        <button type="button" wire:click="$set('periodeKandangId', {{ $pilihan->id }})" wire:key="pilih-kandang-{{ $pilihan->id }}" @class(['dropdown-item', 'active' => $pilihan->is($this->terpilih)])>{{ $pilihan->kandang->nama }}</button>
                                    @endforeach
                                </x-pilih>
                            </div>

                            <label>
                                <span>Tanggal</span>
                                <x-pilih-tanggal
                                    :nilai="$tanggal"
                                    :min="$this->periode->tanggal_chick_in->format('Y-m-d')"
                                    :maks="$this->periode->tanggal_chick_in->copy()->addDays($this->umurMaksimal)->format('Y-m-d')"
                                    x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)"
                                />
                            </label>

                            <div>
                                <span>Usia</span>
                                <strong>{{ $this->umur }} hari</strong>
                            </div>

                            <div>
                                <span id="label-jenis-sampling">Jenis sampling</span>
                                <div class="btn-group dm-button-group btn-group-normal" role="group" aria-labelledby="label-jenis-sampling">
                                    <button type="button" wire:click="pilihJenis(false)" @class(['btn btn-xs btn-outline-light', 'active' => ! $denganSexing]) aria-pressed="{{ $denganSexing ? 'false' : 'true' }}">Tanpa sexing</button>
                                    <button type="button" wire:click="pilihJenis(true)" @class(['btn btn-xs btn-outline-light', 'active' => $denganSexing]) aria-pressed="{{ $denganSexing ? 'true' : 'false' }}">Dengan sexing</button>
                                </div>
                            </div>

                            @foreach ($this->hasil['kelamin'] as $kelamin)
                                <label wire:key="ekor-{{ $kelamin }}">
                                    <span>Ekor per sampel{{ $kelamin === 'campuran' ? '' : ' '.$kelamin }}</span>
                                    <input type="number" min="1" step="1" class="form-control form-control-sm input-ekor @error('ekor.'.$kelamin) is-invalid @enderror" wire:model.blur="ekor.{{ $kelamin }}">
                                </label>
                            @endforeach
                        </div>
                        <p class="fs-12 color-gray mt-10 mb-0">
                            Mulai umur {{ config('sampling.umur_mulai_sexing') }} hari sampel dipisah jantan dan betina; jenis sampling dipilih otomatis dari tanggal dan bisa diganti dengan tombol di atas.
                            Ekor per sampel berlaku untuk semua titik alike; bila ada titik yang ditimbang dengan jumlah ekor berbeda, ubah angkanya di kolom Ekor pada tabel.
                        </p>
                    </div>
                </div>
            </div>

            {{-- Isian per lantai --}}
            @foreach (config('sampling.lantai') as $lantai => $info)
                <div class="col-12 mb-25" wire:key="lantai-{{ $lantai }}-{{ $denganSexing ? 'sexing' : 'campuran' }}">
                    <div class="card border-0 h-100">
                        <div class="card-header border-0">
                            <h6>{{ $info['label'] }}</h6>
                        </div>
                        <div class="card-body pt-0">
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
                </div>
            @endforeach

            {{-- Ringkasan --}}
            <div class="col-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <h6>Ringkasan hasil</h6>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <x-sampling.ringkasan :hasil="$this->hasil" :pakan="$this->pakan" :dengan-sexing="$denganSexing" :umur="$this->umur" />
                        <p class="fs-12 color-gray mt-15 mb-0">
                            ABW hasil sampling ini otomatis mengisi ABW aktual di recording harian tanggal yang sama, jadi tidak perlu disalin manual.
                        </p>
                    </div>
                </div>
            </div>
                </div>

                <x-slot:footer>
                    @if ($errors->any())
                        <span class="color-danger fs-14 me-auto" role="alert">Lengkapi semua berat sampel dan jumlah ekor setiap titik sebelum menyimpan ({{ $errors->count() }} isian belum benar).</span>
                    @endif
                    @if ($sesiId)
                        <button type="button" class="btn btn-primary btn-default btn-squared" wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-sampling" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</button>
                    @else
                        <button type="button" class="btn btn-primary btn-default btn-squared" wire:key="tombol-simpan-baru" wire:click="simpan" wire:loading.attr="disabled" wire:target="simpan">Simpan sampling</button>
                    @endif
                </x-slot:footer>
            </x-modal>

            {{-- Pemberian pakan dan riwayat --}}
            <div class="col-xxl-5 d-flex flex-column">
                <div class="card border-0 px-25 mb-25">
                    <div class="card-header px-0 border-0">
                        <h6>Pemberian pakan {{ $this->terpilih->kandang->nama }}</h6>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <table class="table table--default table-borderless tabel-laporan mb-0">
                            <thead>
                                <tr>
                                    <th>Usia</th>
                                    <th>Tanggal</th>
                                    <th class="text-end">Standar (zak)</th>
                                    <th class="text-end">Aktual (zak)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{{ $this->umur }}</td>
                                    <td>{{ \Illuminate\Support\Carbon::parse($tanggal)->translatedFormat('j F Y') }}</td>
                                    <td class="text-end">@angka($this->pakan['zak_standar'])</td>
                                    <td class="text-end">
                                        @isset($this->pakan['zak'])
                                            @angka($this->pakan['zak'])
                                        @else
                                            <span class="color-gray fs-12">belum dicatat di log pakan</span>
                                        @endisset
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card border-0 px-25 mb-25 flex-grow-1">
                    <div class="card-header px-0 border-0">
                        <h6>Riwayat sampling</h6>
                    </div>
                    <div class="card-body p-0 pb-25">
                        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Jenis</th>
                                    <th class="text-end">ABW</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->riwayat as $sesi)
                                    <tr wire:key="riwayat-{{ $sesi->id }}" @class(['sampling-riwayat--aktif' => $sesi->id === $sesiId])>
                                        <td>
                                            {{ $sesi->tanggal->translatedFormat('j M Y') }}
                                            <span class="d-block fs-12 color-gray">usia {{ $sesi->umur }} hari</span>
                                        </td>
                                        <td>
                                            <span @class(['dm-tag tag-transparented m-0', 'tag-primary' => $sesi->dengan_sexing, 'tag-success' => ! $sesi->dengan_sexing])>{{ $sesi->dengan_sexing ? 'Dengan sexing' : 'Tanpa sexing' }}</span>
                                        </td>
                                        <td class="text-end">
                                            @angka($sesi->abw()) g
                                            @if ($sesi->dengan_sexing)
                                                <span class="d-block fs-12 color-gray">J @angka($sesi->abw('jantan')) / B @angka($sesi->abw('betina'))</span>
                                            @endif
                                        </td>
                                        <td class="text-end">
                                            <button type="button" class="btn btn-xs btn-outline-light" wire:click="buka({{ $sesi->id }})" data-bs-toggle="modal" data-bs-target="#modal-riwayat-sampling">Buka</button>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="color-gray">Belum ada sampling tersimpan untuk kandang ini.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada kandang untuk disampling</h5>
                        <p class="color-gray mb-0">Sampling bobot bisa diisi setelah periode dibuat dan kandangnya diisi populasi awal.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    @if ($this->terpilih)
        @if ($sesiId)
            <x-konfirmasi id="konfirmasi-simpan-sampling" judul="Simpan perubahan sampling {{ $this->labelTanggal }}?" aksi="simpan" tombol="Ya, simpan">
                Hasil sampling {{ $this->terpilih->kandang->nama }} yang sudah tersimpan pada tanggal ini diganti dengan isian form.
            </x-konfirmasi>
        @endif

        <x-memuat target="simpan" teks="Menyimpan sampling" />
        <x-memuat target="periodeKandangId, tanggal" teks="Memuat data sampling" cepat />

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
