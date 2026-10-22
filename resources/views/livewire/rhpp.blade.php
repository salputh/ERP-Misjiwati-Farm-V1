@php($tabsRhpp = ['simulasi' => 'Simulasi', 'bagi-hasil' => 'Bagi Hasil Simulasi', 'real' => 'Real', 'sapronak' => 'Sapronak'])
<div class="container-fluid">
    <div class="row">
        {{-- Pemilih tab memakai tombol dropdown katalog template (Button with dropdown menu), di sebelah breadcrumb. --}}
        <x-breadcrumb judul="Rekapitulasi hasil pemeliharaan peternak" :jejak="['Keuangan', 'RHPP']">
            @if ($this->periode)
                <div class="dropdown dropdown-click rhpp-tab">
                    <div class="btn-group">
                        <a class="btn btn-outline-secondary color-secondary btn-sm" href="{{ route('rhpp', ['periode' => $this->periode->id, 'tab' => $tab]) }}" aria-current="page">{{ $tabsRhpp[$tab] ?? 'RHPP' }}</a>
                        <button type="button" class="btn btn-outline-secondary color-secondary btn-sm dropdown-toggle-split" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Pilih tab RHPP">
                            <img class="svg" src="{{ asset('assets/img/svg/chevron-down.svg') }}" alt="chevron-down">
                        </button>
                        <div class="dropdown-default dropdown-menu">
                            @foreach ($tabsRhpp as $kunci => $label)
                                <a
                                    class="dropdown-item @if ($tab === $kunci) active @endif"
                                    href="{{ route('rhpp', ['periode' => $this->periode->id, 'tab' => $kunci]) }}"
                                    wire:click.prevent="pilihTab('{{ $kunci }}')"
                                    wire:target="pilihTab"
                                    @if ($tab === $kunci) aria-current="page" @endif
                                >{{ $label }}</a>
                            @endforeach
                        </div>
                    </div>
                </div>
            @endif
        </x-breadcrumb>
        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-lg-12 mb-25">
                <x-peringatan warna="secondary" class="mb-25">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @if ($this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body pb-25">
                        <dl class="recording-info">
                            <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</dd></div>
                            <div><dt>DOC masuk</dt><dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd></div>
                        </dl>
                    </div>
                </div>
            </div>

            @if ($tab === 'simulasi')
                @if ($this->simulasi)
                    <x-rhpp.simulasi
                        :lembar="$this->simulasi"
                        :tarif-efisiensi-per-kg="$tarifEfisiensiPerKg"
                        :terkunci="$this->periode->tertutup()"
                    />
                @else
                    <div class="col-lg-12 mb-25">
                        <div class="card border-0">
                            <div class="card-body p-30">
                                <h5 class="mb-10">Belum ada panen di periode ini</h5>
                                <p class="color-gray mb-0">Simulasi penjualan dan hasil usaha muncul setelah nota panen dicatat. Biaya sapronak tetap dapat diperiksa di tab Sapronak.</p>
                            </div>
                        </div>
                    </div>
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
                        :siap-simulasi="(bool) ($this->simulasi['hasil'] ?? false)"
                    />
                @else
                    <div class="col-lg-12 mb-25">
                        <div class="card border-0">
                            <div class="card-body p-30">
                                <h5 class="mb-10">Kandang 2 tidak ada di periode ini</h5>
                                <p class="color-gray mb-0">Simulasi bagi hasil tersedia untuk periode yang memiliki Kandang 2.</p>
                            </div>
                        </div>
                    </div>
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
                    <div class="col-lg-12 mb-25">
                        <div class="card border-0">
                            <div class="card-body p-30">
                                <h5 class="mb-10">RHPP real belum dicatat</h5>
                                <p class="color-gray mb-0">Tab ini terisi setelah dokumen RHPP dari inti untuk periode ini dicatat.</p>
                            </div>
                        </div>
                    </div>
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
                <div class="col-lg-12 mb-25">
                    <div class="card border-0">
                        <div class="card-body p-30">
                            <h5 class="mb-10">Biaya sapronak belum tersedia</h5>
                            <p class="color-gray mb-0">Lengkapi populasi, harga DOC, catatan pakan, dan harga pakan agar biaya dapat dihitung.</p>
                        </div>
                    </div>
                </div>
            @endif
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada panen di periode ini</h5>
                        <p class="color-gray mb-0">RHPP dihitung dari nota timbang panen. Halaman ini terisi setelah nota pertama dicatat.</p>
                    </div>
                </div>
            </div>
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
                <p class="fs-12 color-gray">Masukkan password admin untuk membuka kembali dokumen RHPP real periode ini.</p>
                <x-masukan id="rhpp-sandi-buka" label="Password admin" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
            @elseif ($modeKunci === 'ganti')
                <p class="fs-12 color-gray">Password admin dipakai membuka kunci RHPP real. Simpan baik-baik: tanpa password ini dokumen yang dikunci tidak dapat dibuka dari aplikasi.</p>
                @if ($this->sandiRhppTeratur)
                    <x-masukan id="rhpp-sandi-lama" label="Password lama" tipe="password" wire:model="sandiAdminLama" :kesalahan="$errors->first('sandiAdminLama')" />
                @endif
                <x-masukan id="rhpp-sandi-baru" label="Password baru" tipe="password" wire:model="sandiAdmin" :kesalahan="$errors->first('sandiAdmin')" />
                <x-masukan id="rhpp-sandi-baru-ulang" label="Ulangi password baru" tipe="password" wire:model="sandiAdminUlang" :kesalahan="$errors->first('sandiAdminUlang')" />
            @else
                <p class="fs-12 color-gray">
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
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal">Batal</x-tombol>
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

    <x-memuat target="pilihTab, simpanSimulasi, kunciRhpp, bukaKunciRhpp" teks="Memproses RHPP" cepat />
</div>
