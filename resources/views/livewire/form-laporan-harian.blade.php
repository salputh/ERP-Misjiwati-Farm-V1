<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Form laporan harian" :jejak="['Produksi', 'Laporan harian', 'Form']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="laporan.harian.form" />
        </x-breadcrumb>

        @if ($this->kandang->isNotEmpty())
            {{-- Enter di isian mana pun sama dengan menekan tombol simpan, termasuk konfirmasinya saat mengubah laporan --}}
            <form class="col-12" x-data x-on:submit.prevent="$refs.simpan.click()" novalidate>
                <div class="row">
                    {{-- Tanggal laporan; mengganti tanggal memuat isian tanggal itu --}}
                    <div class="col-lg-12 mb-25">
                        <div class="card border-0">
                            <div class="card-header border-0">
                                <div class="card-extra fs-14 tanpa-kapital">
                                    @if ($this->tersimpan)
                                        <span class="dm-tag tag-info tag-transparented m-0">Mengubah laporan tersimpan</span>
                                    @else
                                        <span class="dm-tag tag-success tag-transparented m-0">Laporan baru</span>
                                    @endif
                                </div>
                            </div>
                            <div class="card-body pt-0">
                                <div class="sampling-pengaturan">
                                    <label>
                                        <span>Tanggal laporan</span>
                                        <x-pilih-tanggal
                                            :nilai="$tanggal"
                                            :min="$this->batas['min']->format('Y-m-d')"
                                            :maks="$this->batas['maks']->format('Y-m-d')"
                                            x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)"
                                        />
                                    </label>
                                    <div>
                                        <span>Usia</span>
                                        <strong>{{ $this->umur }} hari</strong>
                                    </div>
                                    <div>
                                        <span>Periode</span>
                                        <strong>{{ $this->periode->nama }}</strong>
                                    </div>
                                    <div>
                                        <span>Kandang</span>
                                        <strong>{{ $this->kandang->pluck('kandang.nama')->join(', ') }}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12">
                        <div class="row">
                            {{-- Pakan masuk ke farm pada tanggal ini --}}
                            <div class="col-lg-12 mb-25">
                                <div class="card border-0">
                                    <div class="card-header border-0">
                                        <h6>Pakan masuk</h6>
                                        <div class="card-extra fs-14 color-gray tanpa-kapital">zak yang diterima farm pada tanggal ini</div>
                                    </div>
                                    <div class="card-body pb-5">
                                        <div class="row">
                                            @foreach ($this->jenisPakan as $jenis)
                                                <div class="col-md-4" wire:key="masuk-{{ $jenis->id }}">
                                                    <x-laporan.isian :label="$jenis->kode.' (zak)'" :model="'masuk.j'.$jenis->id" langkah="0.5" />
                                                </div>
                                            @endforeach
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {{-- Satu kartu per kandang --}}
                            @foreach ($this->kandang as $satu)
                                <div @class(['mb-25', 'col-xxl-6' => $this->kandang->count() > 1, 'col-lg-12' => $this->kandang->count() === 1]) wire:key="kandang-{{ $satu->id }}">
                                    <div class="card border-0 h-100">
                                        <div class="card-header border-0">
                                            <h6>{{ $satu->kandang->nama }}</h6>
                                            <div class="card-extra fs-14 color-gray tanpa-kapital">sisa @angka($this->sisaSebelum['k'.$satu->id]) dari @angka($satu->populasi_awal) ekor</div>
                                        </div>
                                        <div class="card-body pb-5">
                                            <div class="row">
                                                <div class="col-md-4">
                                                    <x-laporan.isian label="Kematian (ekor)" :model="'isian.k'.$satu->id.'.mati'" />
                                                </div>
                                                <div class="col-md-4">
                                                    <x-laporan.isian label="Afkir (ekor)" :model="'isian.k'.$satu->id.'.afkir'" />
                                                </div>
                                                <div class="col-md-4">
                                                    <x-laporan.isian label="ABW (gram)" :model="'isian.k'.$satu->id.'.abw'" langkah="0.1" />
                                                </div>
                                            </div>

                                            <p class="fs-12 fw-600 color-gray text-uppercase mb-15">Pakan diberikan</p>
                                            <div class="row">
                                                @foreach ($this->jenisPakan as $jenis)
                                                    <div class="col-md-4" wire:key="pakan-{{ $satu->id }}-{{ $jenis->id }}">
                                                        <x-laporan.isian :label="$jenis->kode.' (zak)'" :model="'isian.k'.$satu->id.'.pakan.j'.$jenis->id" langkah="0.5" />
                                                    </div>
                                                @endforeach
                                                @isset($isian['k'.$satu->id]['pakan'][\App\Support\IsianLaporanHarian::TANPA_JENIS])
                                                    <div class="col-md-4">
                                                        <x-laporan.isian label="Jenis belum dicatat (zak)" :model="'isian.k'.$satu->id.'.pakan.'.\App\Support\IsianLaporanHarian::TANPA_JENIS" langkah="0.5" />
                                                    </div>
                                                @endisset
                                            </div>

                                            <div class="form-group mb-20">
                                                <label for="catatan-{{ $satu->id }}" class="il-gray fs-14 fw-500 align-center mb-10">Catatan</label>
                                                <textarea
                                                    id="catatan-{{ $satu->id }}"
                                                    rows="2"
                                                    wire:model="isian.k{{ $satu->id }}.catatan"
                                                    @class(['form-control radius-xs b-light px-15', 'is-invalid' => $errors->has('isian.k'.$satu->id.'.catatan')])
                                                ></textarea>
                                                @error('isian.k'.$satu->id.'.catatan')
                                                    <div class="invalid-feedback d-block">{{ $message }}</div>
                                                @enderror
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>

                    {{-- Simpan, batal, hapus --}}
                    <div class="col-lg-12 mb-25">
                        <div class="card border-0">
                            <div class="card-body d-flex flex-wrap align-items-center gap-3">
                                @if ($this->tersimpan)
                                    <button type="button" class="btn btn-primary btn-default btn-squared px-30" x-ref="simpan" wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-laporan" wire:loading.attr="disabled" wire:target="simpan, hapus">Simpan perubahan</button>
                                @else
                                    <button type="button" class="btn btn-primary btn-default btn-squared px-30" x-ref="simpan" wire:key="tombol-simpan-baru" wire:click="simpan" wire:loading.attr="disabled" wire:target="simpan">Simpan laporan</button>
                                @endif
                                <a href="{{ route('laporan.harian', ['periode' => $this->periode->id]) }}" class="btn btn-default btn-squared border-normal bg-normal px-20">Batal</a>

                                @error('kosong')
                                    <span class="color-danger fs-14" role="alert">{{ $message }}</span>
                                @else
                                    @if ($errors->any())
                                        <span class="color-danger fs-14" role="alert">Periksa lagi isian yang ditandai merah ({{ $errors->count() }} isian).</span>
                                    @endif
                                @enderror

                                @if ($this->tersimpan)
                                    <button type="button" class="btn btn-outline-danger btn-default btn-squared px-20 ms-auto" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-laporan" wire:loading.attr="disabled" wire:target="simpan, hapus">Hapus laporan</button>
                                @endif
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12">
                        <p class="fs-12 color-gray mb-0">
                            Isian yang dikosongkan dianggap belum dicatat, bukan nol. Data yang disimpan langsung dipakai halaman Laporan harian, Recording harian, serta Pakan dan stok.
                            Satu zak = @angka(config('standar.kg_per_zak')) kg.
                        </p>
                    </div>
                </div>
            </form>

            @if ($this->tersimpan)
                <x-konfirmasi id="konfirmasi-simpan-laporan" judul="Simpan perubahan laporan {{ $this->labelTanggal }}?" aksi="simpan" tombol="Ya, simpan">
                    Catatan yang sudah tersimpan pada tanggal ini diganti dengan isian form.
                </x-konfirmasi>

                <x-konfirmasi id="konfirmasi-hapus-laporan" judul="Hapus laporan harian {{ $this->labelTanggal }}?" aksi="hapus" tombol="Ya, hapus" warna="danger">
                    Kematian, afkir, ABW, pakan diberikan, dan pakan masuk pada tanggal ini dihapus dan tidak bisa dikembalikan.
                </x-konfirmasi>
            @endif

            <x-memuat target="simpan" teks="Menyimpan laporan harian" />
            <x-memuat target="hapus" teks="Menghapus laporan harian" />
            <x-memuat target="tanggal" teks="Memuat data tanggal ini" cepat />
        @elseif ($this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Periode ini belum punya kandang</h5>
                        <p class="color-gray mb-0">Laporan harian diisi per kandang. Form ini terbuka setelah kandang ditambahkan ke {{ $this->periode->nama }}.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Laporan harian diisi untuk satu periode. Form ini terbuka setelah periode pertama dibuat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>
</div>
