<div @class(['container-fluid'])>
    <div @class(['row'])>
        <x-breadcrumb judul="Rekapitulasi panen gabungan" :jejak="['Produksi', 'Panen']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="panen.rekap" />
        </x-breadcrumb>

        @if ($pesan)
            <div @class(['col-lg-12'])>
                <div @class(['alert', 'alert-success', 'mb-25']) role="status">
                    <div @class(['alert-content'])><p>{{ $pesan }}</p></div>
                </div>
            </div>
        @endif

        @if ($this->periode)
        @elseif ($this->daftarPeriode->isEmpty())
            <div @class(['col-lg-12', 'mb-25'])>
                <div @class(['card', 'border-0'])>
                    <div @class(['card-body', 'p-30'])>
                        <h5 @class(['mb-10'])>Belum ada periode</h5>
                        <p @class(['color-gray', 'mb-0'])>Nota panen dapat dicatat setelah periode dibuat.</p>
                    </div>
                </div>
            </div>
        @endif

        @if ($this->rekap)
            {{-- Identitas rekap --}}
            <div @class(['col-lg-12', 'mb-25'])>
                <div @class(['card', 'border-0'])>
                    <div @class(['card-body'])>
                        <dl @class(['recording-info', 'mb-0'])>
                            <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Periode</dt><dd>{{ $this->periode->nama }}</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</dd></div>
                            <div><dt>DOC masuk</dt><dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd></div>
                            <div><dt>Masa panen</dt><dd>{{ $this->rekap['mulai']->translatedFormat('j F') }} s/d {{ $this->rekap['selesai']->translatedFormat('j F Y') }}</dd></div>
                            <div><dt>Nota timbang</dt><dd>@angka($this->rekap['total']['jumlah_nota']) nota, {{ count($this->rekap['hari']) }} hari panen</dd></div>
                            
                        </dl>
                    </div>
                </div>
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
                <p @class(['fs-12', 'color-gray', 'mb-0'])>
                    Setiap baris adalah satu nota timbang utuh; nota yang muatannya berasal dari dua kandang dicatat sebagai satu baris. Satu hari panen berjalan dari malam sampai pagi berikutnya.
                </p>
            </div>
        @elseif ($this->periode)
            <div @class(['col-lg-12', 'mb-25'])>
                <div @class(['card', 'border-0'])>
                    <div @class(['card-body', 'p-30'])>
                        <h5 @class(['mb-10'])>Belum ada panen di periode ini</h5>
                        <p @class(['color-gray', 'mb-0'])>Rekap panen muncul setelah nota timbang pertama dicatat.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="ubah, simpan, mintaHapus, hapus" teks="Memproses nota panen" />

    @if ($this->periode)
        <div @class(['modal-basic', 'modal', 'fade']) id="modal-form-nota-panen" tabindex="-1" aria-labelledby="judul-modal-form-nota-panen" aria-hidden="true" wire:ignore.self x-on:nota-panen-disimpan.window="$el.querySelector('[data-bs-dismiss=modal]').click()">
            <div @class(['modal-dialog', 'modal-xl', 'modal-dialog-centered', 'modal-dialog-scrollable'])>
                <div @class(['modal-content', 'modal-bg-white'])>
                    <div @class(['modal-header'])>
                        <h6 @class(['modal-title']) id="judul-modal-form-nota-panen">{{ $notaId ? 'Ubah nota timbang' : 'Tambah nota timbang' }}</h6>
                        <button type="button" @class(['close']) data-bs-dismiss="modal" aria-label="Tutup" wire:click="batalUbah">
                            <i @class(['uil', 'uil-times'])></i>
                        </button>
                    </div>

                    <form wire:submit="simpan">
                        <div @class(['modal-body'])>
                            <div @class(['row'])>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-tanggal" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Tanggal panen</label>
                                    <input id="panen-tanggal" type="date" wire:model="tanggalPanen" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('tanggalPanen')])>
                                    @error('tanggalPanen')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-spa" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>No. SPA <span @class(['color-gray'])>(opsional)</span></label>
                                    <input id="panen-spa" type="text" maxlength="255" wire:model="noSpa" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('noSpa')])>
                                    @error('noSpa')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-btpa" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>No. BTPA</label>
                                    <input id="panen-btpa" type="text" maxlength="255" wire:model="noBtpa" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('noBtpa')])>
                                    @error('noBtpa')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-polisi" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>No. polisi</label>
                                    <input id="panen-polisi" type="text" maxlength="255" wire:model="noPolisi" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('noPolisi')])>
                                    @error('noPolisi')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-pembeli" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Pembeli</label>
                                    <input id="panen-pembeli" type="text" maxlength="255" wire:model="pembeli" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('pembeli')])>
                                    @error('pembeli')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-mulai" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Mulai timbang</label>
                                    <input id="panen-mulai" type="datetime-local" wire:model="mulai" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('mulai')])>
                                    @error('mulai')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-selesai" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Selesai timbang</label>
                                    <input id="panen-selesai" type="datetime-local" wire:model="selesai" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('selesai')])>
                                    @error('selesai')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-krat" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Jumlah krat</label>
                                    <input id="panen-krat" type="number" min="1" step="1" wire:model="jumlahKrat" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('jumlahKrat')])>
                                    @error('jumlahKrat')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-ekor" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Jumlah ekor</label>
                                    <input id="panen-ekor" type="number" min="1" step="1" wire:model="ekor" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('ekor')])>
                                    @error('ekor')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-berat" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Berat panen (kg)</label>
                                    <input id="panen-berat" type="number" min="0.01" max="99999999.99" step="0.01" wire:model="beratKg" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('beratKg')])>
                                    @error('beratKg')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-25'])>
                                    <label for="panen-netto" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Netto nota (kg)</label>
                                    <input id="panen-netto" type="number" min="0" max="99999999.99" step="0.01" wire:model="nettoNotaKg" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('nettoNotaKg')])>
                                    @error('nettoNotaKg')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                                <div @class(['col-md-6', 'form-group', 'mb-0'])>
                                    <label for="panen-tukang-tangkap" @class(['color-dark', 'fs-14', 'fw-500', 'align-center'])>Tukang Tangkap <span @class(['color-gray'])>(opsional, bisa lebih dari satu)</span></label>
                                    <input id="panen-tukang-tangkap" type="text" maxlength="400" wire:model="tukangTangkap" @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid' => $errors->has('tukangTangkap')]) placeholder="Contoh: Rizal, David">
                                    <small class="fs-12 color-gray">Pisahkan nama dengan koma dan gunakan nama yang terdaftar di Master Data agar masuk payroll.</small>
                                    @error('tukangTangkap')<div @class(['invalid-feedback', 'd-block'])>{{ $message }}</div>@enderror
                                </div>
                            </div>
                            @if ($errors->any())
                                <div @class(['color-danger', 'fs-14', 'mt-15']) role="alert">Periksa kembali isian yang ditandai.</div>
                            @endif
                        </div>

                        <div @class(['modal-footer'])>
                            <button type="button" @class(['btn', 'btn-light', 'btn-sm']) data-bs-dismiss="modal" wire:click="batalUbah">Batal</button>
                            <button type="submit" @class(['btn', 'btn-primary', 'btn-sm']) wire:loading.attr="disabled" wire:target="simpan">
                                <span wire:loading.remove wire:target="simpan">{{ $notaId ? 'Simpan perubahan' : 'Simpan data panen' }}</span>
                                <span wire:loading wire:target="simpan">Menyimpan...</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

    <x-konfirmasi id="konfirmasi-hapus-nota-panen" judul="Hapus nota panen {{ $noBtpaDihapus }}?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
        Nota timbang ini dihapus permanen dan angka rekap panen akan dihitung ulang.
        </x-konfirmasi>
    @endif
</div>
