<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekapitulasi panen gabungan" :jejak="['Produksi', 'Panen']" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
        <div class="col-lg-12">
            <x-peringatan warna="success" class="mb-25">
                {{ $pesan }}
            </x-peringatan>
        </div>
        @endif

        @if ($this->periode)
        @elseif ($this->daftarPeriode->isEmpty())
        <div class="col-lg-12 mb-25">
            <x-kartu tanpaHeader="true" class="border-0">
                <h5 class="mb-10">Belum ada periode</h5>
                <p class="color-gray mb-0">Nota panen dapat dicatat setelah periode dibuat.</p>
            </x-kartu>
        </div>
        @endif

        @if ($this->rekap)
        {{-- Identitas rekap --}}
        <div class="col-lg-12 mb-25">
            <x-kartu tanpaHeader="true" class="border-0">
                <dl class="recording-info mb-0">
                    <div>
                        <dt>Inti</dt>
                        <dd>PT. Indojaya Agrinusa</dd>
                    </div>
                    <div>
                        <dt>Farm</dt>
                        <dd>Misjiwati / K0242</dd>
                    </div>
                    <div>
                        <dt>Kandang</dt>
                        <dd>{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</dd>
                    </div>
                    <div>
                        <dt>DOC masuk</dt>
                        <dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd>
                    </div>
                    <div>
                        <dt>Masa panen</dt>
                        <dd>{{ $this->rekap['mulai']->translatedFormat('j F') }} s/d {{ $this->rekap['selesai']->translatedFormat('j F Y') }}</dd>
                    </div>
                    <div>
                        <dt>Nota timbang</dt>
                        <dd>@angka($this->rekap['total']['jumlah_nota']) nota, {{ count($this->rekap['hari']) }} hari panen</dd>
                    </div>
                </dl>
            </x-kartu>
        </div>

        {{-- Angka utama --}}
        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['ekor'])" label="Ekor terpanen" ikon="uil-truck" warna="primary">
            <small>dari @angka($this->rekap['performa']['doc']) ekor DOC (@angka($this->rekap['performa']['hidup_terpanen'], 2)%)</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['berat'], 1).' kg'" label="Total berat panen" ikon="uil-weight" warna="secondary">
            <small>@angka($this->rekap['total']['krat']) krat, rata-rata @angka($this->rekap['total']['per_krat'], 2) kg per krat</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['bw'], 3).' kg'" label="Rata-rata BW" ikon="uil-balance-scale" warna="info">
            <small>umur panen rata-rata @angka($this->rekap['performa']['umur_rata'], 1) hari</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['performa']['fcr'], 3)" label="FCR" ikon="uil-chart-line" warna="warning">
            <small>IP @angka($this->rekap['performa']['ip_terpanen']) (basis ekor terpanen)</small>
        </x-dashboard.kartu>

        <x-panen.nota :hari="$this->rekap['hari']" :total="$this->rekap['total']" :periode-id="$this->periode->id" />

        <x-panen.performa :performa="$this->rekap['performa']" :total="$this->rekap['total']" :tanggal-doc="$this->periode->tanggal_chick_in" />

        <x-panen.umur :umur="$this->rekap['umur']" :total="$this->rekap['total']" :umur-rata="$this->rekap['performa']['umur_rata']" />

        <div @class(['col-lg-12'])>
            <p @class(['fs-12', 'color-gray' , 'mb-0' ])>
                Setiap baris adalah satu nota timbang utuh; nota yang muatannya berasal dari dua kandang dicatat sebagai satu baris. Satu hari panen berjalan dari malam sampai pagi berikutnya.
            </p>
        </div>
        @elseif ($this->periode)
        <div @class(['col-lg-12', 'mb-25' ])>
            <div @class(['card', 'border-0' ])>
                <div @class(['card-body', 'p-30' ])>
                    <h5 @class(['mb-10'])>Belum ada panen di periode ini</h5>
                    <p @class(['color-gray', 'mb-0' ])>Rekap panen muncul setelah nota timbang pertama dicatat.</p>
                </div>
            </div>
        </div>
        @endif
    </div>

    <x-memuat target="ubah, simpan, mintaHapus, hapus" teks="Memproses nota panen" />

    @if ($this->periode)
    <div @class(['modal-basic', 'modal' , 'fade' ]) id="modal-form-nota-panen" tabindex="-1" aria-labelledby="judul-modal-form-nota-panen" aria-hidden="true" wire:ignore.self x-on:nota-panen-disimpan.window="$el.querySelector('[data-bs-dismiss=modal]').click()">
        <div @class(['modal-dialog', 'modal-xl' , 'modal-dialog-centered' , 'modal-dialog-scrollable' ])>
            <form @class(['modal-content', 'modal-bg-white' ]) wire:submit="simpan">
                <div @class(['modal-header'])>
                    <h6 @class(['modal-title']) id="judul-modal-form-nota-panen">{{ $notaId ? 'Ubah nota timbang' : 'Tambah nota timbang' }}</h6>
                    <button type="button" @class(['close']) data-bs-dismiss="modal" aria-label="Tutup" wire:click="batalUbah">
                        <i @class(['uil', 'uil-times' ])></i>
                    </button>
                </div>

                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-tanggal"
                                    label="Tanggal panen"
                                    tipe="date"
                                    wire:model="tanggalPanen"
                                    :kesalahan="$errors->first('tanggalPanen')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-spa"
                                    label="No. SPA"
                                    maxlength="255"
                                    wire:model="noSpa"
                                    :kesalahan="$errors->first('noSpa')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-btpa"
                                    label="No. BTPA"
                                    maxlength="255"
                                    wire:model="noBtpa"
                                    :kesalahan="$errors->first('noBtpa')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-polisi"
                                    label="No. polisi"
                                    maxlength="255"
                                    wire:model="noPolisi"
                                    :kesalahan="$errors->first('noPolisi')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-pembeli"
                                    label="Pembeli"
                                    maxlength="255"
                                    wire:model="pembeli"
                                    :kesalahan="$errors->first('pembeli')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-mulai"
                                    label="Mulai timbang"
                                    tipe="datetime-local"
                                    wire:model="mulai"
                                    :kesalahan="$errors->first('mulai')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-selesai"
                                    label="Selesai timbang"
                                    tipe="datetime-local"
                                    wire:model="selesai"
                                    :kesalahan="$errors->first('selesai')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-krat"
                                    label="Jumlah krat"
                                    tipe="number"
                                    min="1"
                                    step="1"
                                    wire:model="jumlahKrat"
                                    :kesalahan="$errors->first('jumlahKrat')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-ekor"
                                    label="Jumlah ekor"
                                    tipe="number"
                                    min="1"
                                    step="1"
                                    wire:model="ekor"
                                    :kesalahan="$errors->first('ekor')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-berat"
                                    label="Berat panen (kg)"
                                    tipe="number"
                                    min="0.01"
                                    max="99999999.99"
                                    step="0.01"
                                    wire:model="beratKg"
                                    :kesalahan="$errors->first('beratKg')" />
                            </div>
                            <div class="col-md-6">
                                <x-masukan
                                    id="panen-netto"
                                    label="Netto nota (kg)"
                                    tipe="number"
                                    min="0"
                                    max="99999999.99"
                                    step="0.01"
                                    wire:model="nettoNotaKg"
                                    :kesalahan="$errors->first('nettoNotaKg')" />
                            </div>
                            <div class="col-12 mb-0">
                                <x-masukan
                                    id="panen-tukang-tangkap"
                                    label="Tukang Tangkap"
                                    keterangan="(opsional, bisa lebih dari satu)"
                                    maxlength="2000"
                                    wire:model.live.debounce.300ms="tukangTangkap"
                                    :kesalahan="$errors->first('tukangTangkap')"
                                    placeholder="Contoh: Rizal, David, Budi" />
                                <small class="fs-12 color-gray d-block mt-n3 mb-3">Pisahkan nama dengan koma. Nama pemanen yang tidak diberi krat mulai dianggap ikut dari krat pertama.</small>

                                @if ($this->rincianPemanen !== [])
                                <div class="mt-3">
                                    <label @class(['color-dark', 'fs-14' , 'fw-500' , 'align-center' ])>Detail pemanen <span @class(['color-gray'])>(opsional)</span></label>
                                    <small class="fs-12 color-gray d-block mb-2">Isi hanya bila ada pemanen yang mulai di krat berikutnya atau beratnya ingin dicatat terpisah.</small>
                                    @foreach ($this->rincianPemanen as $pemanen)
                                    <div class="row align-items-start mb-2" wire:key="detail-pemanen-{{ $pemanen['kunci'] }}">
                                        <div class="col-md-4">
                                            <span class="form-control-plaintext fw-600">{{ $pemanen['nama'] }}</span>
                                        </div>
                                        <div class="col-md-4">
                                            <input
                                                id="panen-krat-mulai-{{ $pemanen['kunci'] }}"
                                                type="number"
                                                min="1"
                                                max="{{ $jumlahKrat ?: 4294967295 }}"
                                                step="1"
                                                wire:model="detailPemanen.{{ $pemanen['kunci'] }}.kratMulai"
                                                @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid'=> $errors->has("detailPemanen.{$pemanen['kunci']}.kratMulai")])
                                            placeholder="Krat mulai (default 1)"
                                            >
                                            @error("detailPemanen.{$pemanen['kunci']}.kratMulai")<div @class(['invalid-feedback', 'd-block' ])>{{ $message }}</div>@enderror
                                        </div>
                                        <div class="col-md-4">
                                            <input
                                                id="panen-berat-timbang-{{ $pemanen['kunci'] }}"
                                                type="number"
                                                min="0.01"
                                                max="{{ $beratKg ?: 99999999.99 }}"
                                                step="0.01"
                                                wire:model="detailPemanen.{{ $pemanen['kunci'] }}.beratTimbang"
                                                @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid'=> $errors->has("detailPemanen.{$pemanen['kunci']}.beratTimbang")])
                                            placeholder="Berat timbang (kg, opsional)"
                                            >
                                            @error("detailPemanen.{$pemanen['kunci']}.beratTimbang")<div @class(['invalid-feedback', 'd-block' ])>{{ $message }}</div>@enderror
                                        </div>
                                    </div>
                                    @endforeach
                                    @error('detailPemanen')<div @class(['invalid-feedback', 'd-block' ])>{{ $message }}</div>@enderror
                                    <small class="fs-12 color-gray d-block mt-2">Berat aktual digunakan bila diisi. Sisa berat nota dibagi proporsional berdasarkan jumlah krat di antara pemanen yang beratnya kosong.</small>
                                </div>
                                @endif
                            </div>
                        </div>
                        @if ($errors->any())
                        <div class="color-danger fs-14 mt-15" role="alert">Periksa kembali isian yang ditandai.</div>
                        @endif
                    </div>

                    <div class="modal-footer">
                        <x-tombol warna="light" ukuran="sm" data-bs-dismiss="modal" wire:click="batalUbah">Batal</x-tombol>
                        <x-tombol tipe="submit" ukuran="sm" wire:loading.attr="disabled" wire:target="simpan">
                            <span wire:loading.remove wire:target="simpan">{{ $notaId ? 'Simpan perubahan' : 'Simpan data panen' }}</span>
                            <span wire:loading wire:target="simpan">Menyimpan...</span>
                        </x-tombol>
                    </div>
            </form>
        </div>
    </div>

    <x-konfirmasi id="konfirmasi-hapus-nota-panen" judul="Hapus nota panen {{ $noBtpaDihapus }}?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
        Nota timbang ini dihapus permanen dan angka rekap panen akan dihitung ulang.
    </x-konfirmasi>
    @endif
</div>