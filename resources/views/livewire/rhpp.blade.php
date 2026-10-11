<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Rekapitulasi hasil pemeliharaan peternak" :jejak="['Keuangan', 'RHPP']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="rhpp" />
        </x-breadcrumb>

        @if ($this->simulasi)
            {{-- Identitas dan pilihan tab --}}
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body pb-0">
                        <dl class="recording-info">
                            <div><dt>Inti</dt><dd>PT. Indojaya Agrinusa</dd></div>
                            <div><dt>Farm</dt><dd>Misjiwati / K0242</dd></div>
                            <div><dt>Periode</dt><dd>{{ $this->periode->nama }}</dd></div>
                            <div><dt>Kandang</dt><dd>{{ $this->periode->kandangPeriode->sortBy('kandang.nama')->pluck('kandang.nama')->join(', ', ' dan ') }}</dd></div>
                            <div><dt>DOC masuk</dt><dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd></div>
                        </dl>
                        <div class="dm-tab tab-horizontal">
                            <ul class="nav nav-tabs vertical-tabs mb-0" role="tablist">
                                @foreach (['simulasi' => 'Simulasi', 'real' => 'Real'] as $kunci => $label)
                                    <li class="nav-item">
                                        <a
                                            href="{{ route('rhpp', ['periode' => $this->periode->id, 'tab' => $kunci]) }}"
                                            role="tab"
                                            wire:click.prevent="pilihTab('{{ $kunci }}')"
                                            @class(['nav-link', 'active' => $tab === $kunci])
                                            aria-selected="{{ $tab === $kunci ? 'true' : 'false' }}"
                                        >{{ $label }}</a>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            @if ($tab === 'simulasi')
                <x-rhpp.simulasi :lembar="$this->simulasi" />
            @elseif ($this->real)
                <x-rhpp.real :lembar="$this->real" />
            @else
                <div class="col-lg-12 mb-25">
                    <div class="card border-0">
                        <div class="card-body p-30">
                            <h5 class="mb-10">RHPP real belum dicatat</h5>
                            <p class="color-gray mb-0">Tab ini terisi setelah dokumen RHPP dari inti untuk periode ini dicatat. Sementara itu, lihat perkiraannya di tab Simulasi.</p>
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

    <x-memuat target="pilihTab" teks="Memuat RHPP" cepat />
</div>
