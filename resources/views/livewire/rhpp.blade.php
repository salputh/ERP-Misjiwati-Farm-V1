<div class="container-fluid">
    <div class="row" id="halaman-rhpp">
        {{-- Ekspor memotret halaman apa adanya; kartu ringkasan di atas tiap tab ditandai data-lewati-ekspor sehingga tidak ikut. --}}
        <x-breadcrumb judul="Rekapitulasi hasil pemeliharaan peternak" :jejak="['Keuangan', 'RHPP']">
            @if ($this->periode)
                <div class="d-flex gap-2" data-lewati-ekspor x-data="eksporHalaman('#halaman-rhpp', {{ \Illuminate\Support\Js::from($this->namaBerkasEkspor) }})">
                    <x-tombol.kepala warna="white" ikon="bi bi-file-earmark-arrow-down" x-on:click="simpanPdf()" x-bind:disabled="sibuk">Ekspor PDF</x-tombol.kepala>
                    <x-tombol.kepala warna="white" ikon="bi bi-image" x-on:click="simpan()" x-bind:disabled="sibuk">Ekspor PNG</x-tombol.kepala>
                </div>
            @endif
        </x-breadcrumb>
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->periode)
            {{-- Tab lembar RHPP  --}}
            <div class="col-12">
                <div class="project-top-wrapper d-flex justify-content-between flex-wrap mt-n2 mb-3">
                    <div class="my-2">
                        <ul class="nav nav-pills nav-sm" role="tablist" aria-label="Lembar RHPP">
                            @foreach (['simulasi' => 'Simulasi', 'bagi-hasil' => 'Bagi Hasil Simulasi', 'real' => 'Real', 'sapronak' => 'Sapronak'] as $kunci => $label)
                                <li class="nav-item">
                                    <a
                                        href="{{ route('rhpp', ['periode' => $this->periode->id, 'tab' => $kunci]) }}"
                                        role="tab"
                                        @class(['nav-link', 'active' => $tab === $kunci])
                                        aria-selected="{{ $tab === $kunci ? 'true' : 'false' }}"
                                        wire:click.prevent="pilihTab('{{ $kunci }}')"
                                    >{{ $label }}</a>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                </div>
            </div>

            <div class="col-12 mb-4">
                <section class="card basalt-box db-card">
<div class="db-card-body">
                        <x-info>
                            <x-info.butir label="Inti">PT. Indojaya Agrinusa</x-info.butir>
                            <x-info.butir label="Farm">Misjiwati / K0242</x-info.butir>
                            <x-info.butir label="Kandang">{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</x-info.butir>
                            <x-info.butir label="DOC masuk">{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</x-info.butir>
                        </x-info>
                    
</div>
</section>
            </div>

            @if ($tab === 'simulasi')
                @if ($this->simulasi)
                    <x-rhpp.simulasi
                        :lembar="$this->simulasi"
                        :tarif-efisiensi-per-kg="$tarifEfisiensiPerKg"
                        :terkunci="$this->periode->tertutup()"
                    />
                @else
                    <x-kosong judul="Belum ada panen di periode ini">Simulasi penjualan dan hasil usaha muncul setelah nota panen dicatat. Biaya sapronak tetap dapat diperiksa di tab Sapronak.</x-kosong>
                @endif
            @elseif ($tab === 'bagi-hasil')
                @if ($this->periodeKandangKedua)
                    <x-rhpp.bagi-hasil-simulasi
                        :periode-kandang="$this->periodeKandangKedua"
                        :masukan="$masukanBagiHasil"
                        :abk="$abkSimulasi"
                        :entertain="$entertainSimulasi"
                        :pemodal="$pemodalSimulasi"
                        :proyeksi="$this->proyeksiBagiHasilSimulasi"
                        :hasil="$hasilSimulasiBagiHasil"
                        :sumber-asumsi="$sumberAsumsiBagiHasil"
                        :tarif-dari-master="$tarifDariMaster"
                        :siap-simulasi="(bool) ($this->simulasi['hasil'] ?? false)"
                    />
                @else
                    <x-kosong judul="Kandang 2 tidak ada di periode ini">Simulasi bagi hasil tersedia untuk periode yang memiliki Kandang 2.</x-kosong>
                @endif
            @elseif ($tab === 'real')
                @if ($this->real)
                    <x-rhpp.real
                        :lembar="$this->real"
                        :masukan="$masukanReal"
                        :harga-panen="$hargaPanenReal"
                        :nota="$this->notaReal"
                        :dapat-diubah="! $this->periode->tertutup()"
                        :terkunci="$this->rhppTerkunci"
                    />
                @else
                    <x-kosong judul="RHPP real belum dicatat">Tab ini terisi setelah dokumen RHPP dari inti untuk periode ini dicatat.</x-kosong>
                    @unless ($this->periode->tertutup())
                        <x-rhpp.real
                            :lembar="null"
                            :masukan="$masukanReal"
                            :harga-panen="$hargaPanenReal"
                            :nota="$this->notaReal"
                            dapat-diubah
                        />
                    @endunless
                @endif
            @elseif ($this->sapronak)
                <x-rhpp.sapronak :simulasi="$this->sapronak" :real="$this->real" />
            @else
                <x-kosong judul="Biaya sapronak belum tersedia">Lengkapi populasi, harga DOC, catatan pakan, dan harga pakan agar biaya dapat dihitung.</x-kosong>
            @endif
        @else
            <x-kosong judul="Belum ada panen di periode ini">RHPP dihitung dari nota timbang panen. Halaman ini terisi setelah nota pertama dicatat.</x-kosong>
        @endif
    </div>

    <x-modal
        id="modal-kunci-rhpp"
        :judul="match ($modeKunci) {
            'buka' => 'Buka kunci RHPP real',
            'ganti' => 'Ganti password admin RHPP',
            default => 'Kunci RHPP real',
        }"
        x-on:tutup-modal-kunci-rhpp.window="bootstrap.Modal.getInstance($el).hide()" submit="{{ match ($modeKunci) {
            'buka' => 'bukaKunciRhpp',
            'ganti' => 'ubahPasswordAdmin',
            default => 'kunciRhpp',
        } }}">
        
            @if ($modeKunci === 'buka')
                <p class="small text-body-secondary">Masukkan password admin untuk membuka kembali dokumen RHPP real periode ini.</p>
                <x-masukan id="rhpp-sandi-buka" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
            @elseif ($modeKunci === 'ganti')
                <p class="small text-body-secondary">Password admin dipakai membuka kunci RHPP real. Simpan baik-baik: tanpa password ini dokumen yang dikunci tidak dapat dibuka dari aplikasi.</p>
                @if ($this->sandiRhppTeratur)
                    <x-masukan id="rhpp-sandi-lama" label="Password lama" tipe="password" wire:model="sandiAdminLama" :kesalahan="$errors->first('sandiAdminLama')" />
                @endif
                <x-masukan id="rhpp-sandi-baru" label="Password baru" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
                <x-masukan id="rhpp-sandi-baru-ulang" label="Ulangi password baru" tipe="password" wire:model="sandiAdminUlang" :kesalahan="$errors->first('sandiAdminUlang')" />
            @else
                <p class="small text-body-secondary">
                    @if ($this->sandiRhppTeratur)
                        Dokumen RHPP real akan dikunci sehingga tidak dapat diubah. Masukkan password admin untuk mengunci.
                    @else
                        Password admin belum pernah ditetapkan. Tentukan password admin berikut; password inilah yang dipakai membuka kunci RHPP nanti.
                    @endif
                </p>
                <x-masukan id="rhpp-sandi-kunci" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
                @unless ($this->sandiRhppTeratur)
                    <x-masukan id="rhpp-sandi-kunci-ulang" label="Ulangi password admin" tipe="password" wire:model="sandiAdminUlang" :kesalahan="$errors->first('sandiAdminUlang')" />
                @endunless
            @endif
            <x-slot:footer>
                <x-tombol.batal />
                @if ($modeKunci === 'kunci')
                    <x-tombol tipe="button" variasi="outlined" wire:click="bukaModalGantiPassword">Ganti password admin</x-tombol>
                @endif
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="kunciRhpp, bukaKunciRhpp, ubahPasswordAdmin">
                    {{ match ($modeKunci) {
                        'buka' => 'Buka kunci',
                        'ganti' => 'Simpan password',
                        default => 'Kunci RHPP',
                    } }}
                </x-tombol>
            </x-slot:footer>
        </x-modal>

    <x-memuat target="pilihTab" teks="Memuat lembar RHPP" cepat />
    <x-memuat target="simpanSimulasi, simpanReal, kunciRhpp, bukaKunciRhpp, ubahPasswordAdmin" teks="Memproses RHPP" />
</div>
