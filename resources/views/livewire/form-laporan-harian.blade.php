<div>
    @if (! $inline)
    <div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Form laporan harian" :jejak="['Produksi', 'Laporan harian', 'Form']" />

        @if ($this->kandang->isNotEmpty())
            <div class="col-12 mb-25">
                <x-kartu :judul="$this->tersimpan ? 'Ubah laporan harian' : 'Laporan harian baru'" :subjudul="$this->labelTanggal.' · '.$this->kandang->pluck('kandang.nama')->join(', ')">
                    <x-slot:ekstra>
                        <x-tombol data-bs-toggle="modal" data-bs-target="#modal-form-laporan-harian">{{ $this->tersimpan ? 'Ubah laporan' : 'Isi laporan' }}</x-tombol>
                    </x-slot:ekstra>
                    <p class="fs-14 color-gray mb-0">Buka form untuk mengisi kematian, afkir, ABW, pakan diberikan, dan pakan masuk pada tanggal ini.</p>
                </x-kartu>
            </div>
        @elseif ($this->periode)
            <x-kosong judul="Periode ini belum punya kandang">Laporan harian diisi per kandang. Form ini terbuka setelah kandang ditambahkan ke periode terpilih.</x-kosong>
        @else
            <x-kosong judul="Belum ada periode">Laporan harian diisi untuk satu periode. Form ini terbuka setelah periode pertama dibuat.</x-kosong>
        @endif
    </div>
    </div>
    @endif

    @if ($this->kandang->isNotEmpty())
        <x-modal
            id="modal-form-laporan-harian"
            :judul="$this->tersimpan ? 'Ubah laporan harian' : 'Laporan harian baru'"
            ukuran="xl">
            {{-- Enter di isian mana pun sama dengan menekan tombol simpan, termasuk konfirmasinya saat mengubah laporan --}}
            <form x-data x-on:submit.prevent="$refs.simpan.click()" novalidate>
                {{-- Tanggal laporan; mengganti tanggal memuat isian tanggal itu --}}
                <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-25">
                    <x-info>
                        <div>
                            <span class="d-block color-light fs-12 mb-1">Tanggal laporan</span>
                            <x-pilih-tanggal
                                :nilai="$tanggal"
                                :min="$this->batas['min']->format('Y-m-d')"
                                :maks="$this->batas['maks']->format('Y-m-d')"
                                x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)"
                            />
                        </div>
                        <x-info.butir label="Usia">{{ $this->umur }} hari</x-info.butir>
                        <x-info.butir label="Kandang">{{ $this->kandang->pluck('kandang.nama')->join(', ') }}</x-info.butir>
                    </x-info>
                    @if ($this->tersimpan)
                        <span class="dm-tag tag-info tag-transparented m-0">Mengubah laporan tersimpan</span>
                    @else
                        <span class="dm-tag tag-success tag-transparented m-0">Laporan baru</span>
                    @endif
                </div>

                <div class="row">
                    {{-- Pakan masuk ke farm pada tanggal ini --}}
                    <div class="col-12 mb-25">
                        <div class="card card-default card-sm bg-transparent card-bordered">
                            <div class="card-header">
                                <h6>Pakan masuk</h6>
                                <div class="card-extra fs-13 color-light tanpa-kapital">zak yang diterima farm pada tanggal ini</div>
                            </div>
                            <div class="card-body pb-0">
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

                    {{-- Satu kartu bergaris per kandang --}}
                    @foreach ($this->kandang as $satu)
                        <div @class(['mb-25', 'col-xxl-6' => $this->kandang->count() > 1, 'col-12' => $this->kandang->count() === 1]) wire:key="kandang-{{ $satu->id }}">
                            <div class="card card-default card-sm bg-transparent card-bordered h-100">
                                <div class="card-header">
                                    <h6>{{ $satu->kandang->nama }}</h6>
                                    <div class="card-extra fs-13 color-light tanpa-kapital">sisa @angka($this->sisaSebelum['k'.$satu->id]) dari @angka($satu->populasi_awal) ekor</div>
                                </div>
                                <div class="card-body pb-0">
                                    <div class="row">
                                        <div class="col-md-4">
                                            <x-laporan.isian label="Kematian (ekor)" :model="'isian.k'.$satu->id.'.mati'" />
                                        </div>
                                        <div class="col-md-4">
                                            <x-laporan.isian label="Afkir (ekor)" :model="'isian.k'.$satu->id.'.afkir'" />
                                        </div>
                                        <div class="col-md-4">
                                            <x-masukan.ribuan :id="'isian.k'.$satu->id.'.abw'" :properti="'isian.k'.$satu->id.'.abw'" :desimal="1" teks label="ABW (gram)" :kesalahan="$errors->first('isian.k'.$satu->id.'.abw')" />
                                        </div>
                                    </div>

                                    <span class="d-block fs-14 fw-500 color-dark mb-15">Pakan diberikan</span>
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

                                    <div class="form-group mb-25">
                                        <label for="catatan-{{ $satu->id }}" class="il-gray fs-14 fw-500 align-center mb-10">Catatan</label>
                                        <textarea
                                            id="catatan-{{ $satu->id }}"
                                            rows="2"
                                            wire:model="isian.k{{ $satu->id }}.catatan"
                                            @class(['form-control ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('isian.k'.$satu->id.'.catatan')])
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

                <p class="fs-13 color-light mb-25">
                    Isian yang dikosongkan dianggap belum dicatat, bukan nol. Data yang disimpan langsung dipakai halaman Laporan harian, Recording harian, serta Pakan dan stok.
                    Konversi pakan ke kg memakai berat per zak pada master tiap jenis pakan.
                </p>

                {{-- Simpan, batal, hapus --}}
                <div class="d-flex flex-wrap align-items-center gap-2 border-top pt-20">
                    <a href="{{ route('laporan.harian', ['periode' => $this->periode->id]) }}" class="btn btn-light btn-outlined btn-sm">Batal</a>
                    @if ($this->tersimpan)
                        <x-tombol x-ref="simpan" wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-laporan" wire:loading.attr="disabled" wire:target="simpan, hapus">Simpan perubahan</x-tombol>
                    @else
                        <x-tombol x-ref="simpan" wire:key="tombol-simpan-baru" wire:click="simpan" wire:loading.attr="disabled" wire:target="simpan">Simpan laporan</x-tombol>
                    @endif

                    @error('kosong')
                        <span class="color-danger fs-14" role="alert">{{ $message }}</span>
                    @else
                        @if ($errors->any())
                            <span class="color-danger fs-14" role="alert">Periksa lagi isian yang ditandai merah ({{ $errors->count() }} isian).</span>
                        @endif
                    @enderror

                    @if ($this->tersimpan)
                        <x-tombol warna="danger" variasi="outlined" class="ms-auto" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-laporan" wire:loading.attr="disabled" wire:target="simpan, hapus">Hapus laporan</x-tombol>
                    @endif
                </div>
            </form>
        </x-modal>

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
    @endif
</div>
