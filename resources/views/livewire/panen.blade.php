<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekapitulasi panen gabungan" :jejak="['Produksi', 'Panen']" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if (! $this->periode && $this->daftarPeriode->isEmpty())
            <x-kosong judul="Belum ada periode">Nota panen dapat dicatat setelah periode dibuat.</x-kosong>
        @endif

        @if ($this->rekap)
        {{-- Identitas rekap --}}
        <div class="col-12 mb-4">
            <section class="card basalt-box db-card">
<div class="db-card-body">
                    <x-info>
                        <x-info.butir label="Inti">PT. Indojaya Agrinusa</x-info.butir>
                        <x-info.butir label="Farm">Misjiwati / K0242</x-info.butir>
                        <x-info.butir label="Kandang">{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</x-info.butir>
                        <x-info.butir label="DOC masuk">{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</x-info.butir>
                        <x-info.butir label="Masa panen">{{ $this->rekap['mulai']->translatedFormat('j F') }} s/d {{ $this->rekap['selesai']->translatedFormat('j F Y') }}</x-info.butir>
                        <x-info.butir label="Nota timbang">@angka($this->rekap['total']['jumlah_nota']) nota, {{ count($this->rekap['hari']) }} hari panen</x-info.butir>
                    </x-info>
                
</div>
</section>
        </div>

        {{-- Angka utama --}}
        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['ekor'])" label="Ekor terpanen" ikon="bi-truck" warna="primary">
            <small>dari @angka($this->rekap['performa']['doc']) ekor DOC (@angka($this->rekap['performa']['hidup_terpanen'], 2)%)</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['berat'], 1).' kg'" label="Total berat panen" ikon="bi-speedometer2" warna="secondary">
            <small>@angka($this->rekap['total']['krat']) krat, rata-rata @angka($this->rekap['total']['per_krat'], 2) kg per krat</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['total']['bw'], 3).' kg'" label="Rata-rata BW" ikon="bi-calculator" warna="info">
            <small>umur panen rata-rata @angka($this->rekap['performa']['umur_rata'], 1) hari</small>
        </x-dashboard.kartu>

        <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->rekap['performa']['fcr'], 3)" label="FCR" ikon="bi-graph-up" warna="warning">
            <small>IP @angka($this->rekap['performa']['ip_terpanen']) (basis ekor terpanen)</small>
        </x-dashboard.kartu>

        <x-panen.nota :hari="$this->rekap['hari']" :total="$this->rekap['total']" :periode-id="$this->periode->id" :bisa-diubah="! $this->periode->tertutup()" />

        <x-panen.performa :performa="$this->rekap['performa']" :total="$this->rekap['total']" :tanggal-doc="$this->periode->tanggal_chick_in" />

        <x-panen.umur :umur="$this->rekap['umur']" :total="$this->rekap['total']" :umur-rata="$this->rekap['performa']['umur_rata']" />

        <div class="col-12 mb-4">
            <p class="small text-body-secondary mb-0">
                Setiap baris adalah satu nota timbang utuh; nota yang muatannya berasal dari dua kandang dicatat sebagai satu baris. Satu hari panen berjalan dari malam sampai pagi berikutnya.
            </p>
        </div>
        @elseif ($this->periode)
            <x-kosong judul="Belum ada panen di periode ini">Rekap panen muncul setelah nota timbang pertama dicatat.</x-kosong>
        @endif
    </div>

    <x-memuat target="ubah, simpan, mintaHapus, hapus" teks="Memproses nota panen" />

    @if ($this->periode)
    <x-modal
        id="modal-form-nota-panen"
        :judul="$notaId ? 'Ubah nota timbang' : 'Tambah nota timbang'"
        ukuran="xl"
        submit="simpan"
        aksi-tutup="batalUbah"
        x-on:nota-panen-disimpan.window="bootstrap.Modal.getInstance($el).hide()">
        {{-- Identitas nota --}}
        <section class="card basalt-box db-card bg-transparent mb-4">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Identitas nota</h2></div>
</header>
                <div class="row">
                    <div class="col-md-4">
                        <div class="mb-3 mb-4">
                            <label for="panen-tanggal" class="form-label fw-medium mb-2">Tanggal panen</label>
                            <x-pilih-tanggal id="panen-tanggal" ukuran="medium" :nilai="$tanggalPanen" :kesalahan="$errors->has('tanggalPanen')" x-on:tanggal-dipilih="$wire.set('tanggalPanen', $event.detail)" />
                            @error('tanggalPanen')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="panen-btpa" label="No. BTPA" maxlength="255" placeholder="Contoh: 016978" wire:model="noBtpa" :kesalahan="$errors->first('noBtpa')" autocomplete="off" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="panen-spa" label="No. SPA" maxlength="255" placeholder="Boleh dikosongkan" wire:model="noSpa" :kesalahan="$errors->first('noSpa')" autocomplete="off" />
                    </div>
                    <div class="col-md-8">
                        <x-masukan id="panen-pembeli" label="Pembeli" maxlength="255" placeholder="Contoh: Abdillah Akbar. CV" wire:model="pembeli" :kesalahan="$errors->first('pembeli')" />
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="panen-polisi" label="No. polisi" maxlength="255" placeholder="Contoh: BM 8653 PI" wire:model="noPolisi" :kesalahan="$errors->first('noPolisi')" autocomplete="off" />
                    </div>
                </div>
            
</div>
</section>

        {{-- Waktu timbang --}}
        <section class="card basalt-box db-card bg-transparent mb-4">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Waktu timbang</h2></div>
                <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary tanpa-kapital">
                    @isset($this->ringkasanForm['durasi_menit'])
                        lama timbang @angka($this->ringkasanForm['durasi_menit']) menit
                    @endisset
                </div>
</header>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3 mb-4">
                            <label for="panen-mulai" class="form-label fw-medium mb-2">Mulai timbang</label>
                            <x-pilih-waktu id="panen-mulai" :nilai="$mulai" :kesalahan="$errors->has('mulai')" x-on:waktu-dipilih="$wire.set('mulai', $event.detail)" />
                            @error('mulai')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3 mb-4">
                            <label for="panen-selesai" class="form-label fw-medium mb-2">Selesai timbang</label>
                            <x-pilih-waktu id="panen-selesai" :nilai="$selesai" :kesalahan="$errors->has('selesai')" x-on:waktu-dipilih="$wire.set('selesai', $event.detail)" />
                            @error('selesai')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                    </div>
                </div>
            
</div>
</section>

        {{-- Hasil timbang, dengan angka turunan untuk memeriksa salah ketik --}}
        <section class="card basalt-box db-card bg-transparent mb-4">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Hasil timbang</h2></div>
</header>
                <div class="row">
                    <div class="col-md-3 col-6">
                        <x-masukan id="panen-krat" label="Jumlah krat" tipe="number" min="1" step="1" placeholder="0" wire:model.live.debounce.500ms="jumlahKrat" :kesalahan="$errors->first('jumlahKrat')" />
                    </div>
                    <div class="col-md-3 col-6">
                        <x-masukan.ribuan properti="ekor" teks langsung id="panen-ekor" label="Jumlah ekor" placeholder="0" :kesalahan="$errors->first('ekor')" />
                    </div>
                    <div class="col-md-3 col-6">
                        <x-masukan.ribuan properti="beratKg" :desimal="2" teks langsung id="panen-berat" label="Berat timbang (kg)" placeholder="0,00" :kesalahan="$errors->first('beratKg')" />
                    </div>
                    <div class="col-md-3 col-6">
                        <x-masukan.ribuan properti="nettoNotaKg" :desimal="2" teks langsung id="panen-netto" label="Netto nota (kg)" placeholder="0,00" :kesalahan="$errors->first('nettoNotaKg')" />
                    </div>
                </div>
                <div class="row g-3 mb-4">
                    <div class="col-md-3 col-6">
                        <x-info.butir label="BW rata-rata">
                            @isset($this->ringkasanForm['bw'])
                                @angka($this->ringkasanForm['bw'], 3) kg
                            @else
                                -
                            @endisset
                        </x-info.butir>
                    </div>
                    <div class="col-md-3 col-6">
                        <x-info.butir label="Berat per krat">
                            @isset($this->ringkasanForm['per_krat'])
                                @angka($this->ringkasanForm['per_krat'], 2) kg
                            @else
                                -
                            @endisset
                        </x-info.butir>
                    </div>
                    <div class="col-md-3 col-6">
                        <x-info.butir label="Ekor per krat">
                            @isset($this->ringkasanForm['ekor_per_krat'])
                                @angka($this->ringkasanForm['ekor_per_krat'], 1)
                            @else
                                -
                            @endisset
                        </x-info.butir>
                    </div>
                    <div class="col-md-3 col-6">
                        <x-info.butir label="Selisih timbang − netto">
                            @isset($this->ringkasanForm['selisih'])
                                <span @class(['text-danger' => $this->ringkasanForm['selisih'] != 0])>@kurung($this->ringkasanForm['selisih'], 2) kg</span>
                            @else
                                -
                            @endisset
                        </x-info.butir>
                    </div>
                </div>
            
</div>
</section>

        {{-- Tim tangkap --}}
        <section class="card basalt-box db-card bg-transparent">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Tim tangkap <span class="small text-body-secondary fw-normal">(opsional)</span></h2></div>
</header>
                <x-masukan
                    id="panen-tukang-tangkap"
                    label="Nama tukang tangkap"
                    keterangan="Pisahkan nama dengan koma. Tanpa krat mulai, setiap nama dihitung dari krat pertama."
                    maxlength="2000"
                    wire:model.live.debounce.300ms="tukangTangkap"
                    :kesalahan="$errors->first('tukangTangkap')"
                    placeholder="Contoh: Rizal, David, Budi" />

                @if ($this->rincianPemanen !== [])
                    <p class="small text-body-secondary mb-3">Isi krat mulai atau berat timbang hanya bila ada pemanen yang mulai di krat berikutnya, atau beratnya ditimbang terpisah. Sisa berat nota dibagi menurut jumlah krat di antara pemanen yang beratnya kosong.</p>
                    <div class="tabel-data table-responsive">
                        <table class="table tabel-laporan mb-0 db-table">
                            <thead>
                                <tr>
                                    <th>Pemanen</th>
                                    <th>Krat mulai</th>
                                    <th>Berat timbang (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($this->rincianPemanen as $pemanen)
                                    <tr wire:key="detail-pemanen-{{ $pemanen['kunci'] }}">
                                        <td class="fw-medium text-body align-middle">{{ $pemanen['nama'] }}</td>
                                        <td>
                                            <label class="visually-hidden" for="panen-krat-mulai-{{ $pemanen['kunci'] }}">Krat mulai {{ $pemanen['nama'] }}</label>
                                            <input
                                                id="panen-krat-mulai-{{ $pemanen['kunci'] }}"
                                                type="number"
                                                min="1"
                                                max="{{ $jumlahKrat ?: 4294967295 }}"
                                                step="1"
                                                wire:model="detailPemanen.{{ $pemanen['kunci'] }}.kratMulai"
                                                @class(['form-control form-control-sm    px-3', 'is-invalid' => $errors->has("detailPemanen.{$pemanen['kunci']}.kratMulai")])
                                                placeholder="1"
                                            >
                                            @error("detailPemanen.{$pemanen['kunci']}.kratMulai")<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                        </td>
                                        <td>
                                            <label class="visually-hidden" for="panen-berat-timbang-{{ $pemanen['kunci'] }}">Berat timbang {{ $pemanen['nama'] }}</label>
                                            <input
                                                id="panen-berat-timbang-{{ $pemanen['kunci'] }}"
                                                type="text"
                                                inputmode="decimal"
                                                autocomplete="off"
                                                x-data="isianRibuan('detailPemanen.{{ $pemanen['kunci'] }}.beratTimbang', '.', false, { desimal: 2, teks: true })"
                                                x-on:input="format"
                                                x-on:blur="kirim(true)"
                                                @class(['form-control form-control-sm    px-3', 'is-invalid' => $errors->has("detailPemanen.{$pemanen['kunci']}.beratTimbang")])
                                                placeholder="dibagi menurut krat"
                                            >
                                            @error("detailPemanen.{$pemanen['kunci']}.beratTimbang")<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    @error('detailPemanen')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                @endif
            
</div>
</section>

        @if ($errors->any())
            <x-peringatan warna="danger" class="mt-3 mb-0">Periksa kembali isian yang ditandai.</x-peringatan>
        @endif

        <x-slot:footer>
            <x-tombol.batal wire:click="batalUbah" />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">{{ $notaId ? 'Simpan perubahan' : 'Simpan data panen' }}</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-panen.modal-nota :detail="$this->notaDilihat" />

    <x-konfirmasi id="konfirmasi-hapus-nota-panen" judul="Hapus nota panen {{ $noBtpaDihapus }}?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus, hapus">
        Nota timbang ini dihapus permanen dan angka rekap panen akan dihitung ulang.
    </x-konfirmasi>
    @endif
</div>