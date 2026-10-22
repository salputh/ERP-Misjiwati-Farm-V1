<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Recording harian pemeliharaan ayam broiler" :jejak="['Produksi', 'Recording harian']" />

        @if ($this->terpilih)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-header border-0">
                        <div class="card-extra d-flex align-items-center flex-wrap gap-2">
                            <div class="dropdown action-btn">
                                <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" id="dropdownExportRecording" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="la la-download"></i> Export
                                </button>
                                <div class="dropdown-menu dropdown-menu-end" aria-labelledby="dropdownExportRecording">
                                    <span class="dropdown-item">Export With</span>
                                    <div class="dropdown-divider"></div>
                                    <a href="{{ route('recording.harian.export', ['periodeKandang' => $this->terpilih->id, 'format' => 'pdf']) }}" class="dropdown-item">
                                        <i class="la la-file-pdf"></i> PDF
                                    </a>
                                    <a href="{{ route('recording.harian.export', ['periodeKandang' => $this->terpilih->id, 'format' => 'xlsx']) }}" class="dropdown-item">
                                        <i class="la la-file-excel"></i> Excel (XLSX)
                                    </a>
                                </div>
                            </div>
                            <ul class="card-tab-links nav-tabs nav" role="tablist">
                                @foreach ($this->daftarKandang as $pilihan)
                                    <li>
                                        <a
                                            href="{{ route('recording.harian', ['periode' => $this->periode->id, 'kandang' => $pilihan->id]) }}"
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

                    <div class="card-body pt-0">
                        <dl class="recording-info">
                            <div><dt>Peternak</dt><dd>Misjiwati</dd></div>
                            <div><dt>Populasi</dt><dd>@angka($this->terpilih->populasi_awal) ekor</dd></div>
                            <div><dt>Tanggal chick-in</dt><dd>{{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</dd></div>
                            <div><dt>Berat DOC</dt><dd>@angka($this->periode->berat_doc_gram) g</dd></div>
                        </dl>

                        <div class="recording-gulung" tabindex="0" role="region" aria-label="Tabel recording harian {{ $this->terpilih->kandang->nama }}, bisa digulir">
                            <table class="table table-bordered tabel-recording mb-0">
                                <thead>
                                    <tr class="recording-kepala-1">
                                        <th rowspan="3" class="recording-lekat-1">Tanggal</th>
                                        <th rowspan="3" class="recording-lekat-2">Umur</th>
                                        <th colspan="6" class="grup-awal">Deplesi</th>
                                        <th colspan="10" class="grup-awal">Pakan</th>
                                        <th colspan="8" class="grup-awal">Body weight</th>
                                        <th colspan="2" rowspan="2" class="grup-awal">%tase pakan vs BW</th>
                                        <th colspan="3" rowspan="2" class="grup-awal">FCR</th>
                                        <th rowspan="3" class="grup-awal">Saldo ayam</th>
                                    </tr>
                                    <tr class="recording-kepala-2">
                                        <th colspan="4" class="grup-awal">Aktual</th>
                                        <th colspan="2">Standar</th>
                                        <th colspan="4" class="grup-awal">Standar</th>
                                        <th colspan="4">Aktual</th>
                                        <th colspan="2">Selisih</th>
                                        <th colspan="2" class="grup-awal">Standar</th>
                                        <th colspan="4">Aktual</th>
                                        <th colspan="2">Selisih</th>
                                    </tr>
                                    <tr class="recording-kepala-3">
                                        <th class="grup-awal">Mati</th>
                                        <th>Afkir</th>
                                        <th>Jml cum</th>
                                        <th>Cum %</th>
                                        <th>Cum %</th>
                                        <th>Cum (ekor)</th>

                                        <th class="grup-awal">Zak</th>
                                        <th>Cum (zak)</th>
                                        <th>Gr/ek</th>
                                        <th>Cum (gr)</th>
                                        <th>Zak</th>
                                        <th>Cum (zak)</th>
                                        <th>Gr/ek</th>
                                        <th>Cum gr/ek</th>
                                        <th>Zak</th>
                                        <th>Gr/ek</th>

                                        <th class="grup-awal">ABW (gr)</th>
                                        <th>DG (gr)</th>
                                        <th>ABW (gr)</th>
                                        <th>DG (gr)</th>
                                        <th>Cum DG</th>
                                        <th>Cum %tase</th>
                                        <th>ABW (gr)</th>
                                        <th>DG (gr)</th>

                                        <th class="grup-awal">Std</th>
                                        <th>Act</th>

                                        <th class="grup-awal">Std</th>
                                        <th>Act</th>
                                        <th>Selisih</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($this->baris as $hari)
                                        <tr wire:key="hari-{{ $this->terpilih->id }}-{{ $hari['umur'] }}" @class(['recording-belum' => ! $hari['terisi']])>
                                            <th scope="row" class="recording-lekat-1">{{ $hari['tanggal']->translatedFormat('j F') }}</th>
                                            <td class="recording-lekat-2">{{ $hari['umur'] }}</td>

                                            <x-recording.sel :nilai="$hari['mati']" masukan class="grup-awal" />
                                            <x-recording.sel :nilai="$hari['afkir']" masukan />
                                            <x-recording.sel :nilai="$hari['deplesi_kumulatif']" />
                                            <x-recording.sel :nilai="$hari['deplesi_persen']" :desimal="1" akhiran="%" />
                                            <x-recording.sel :nilai="$hari['deplesi_persen_standar']" :desimal="2" />
                                            <x-recording.sel :nilai="$hari['deplesi_ekor_standar']" />

                                            <x-recording.sel :nilai="$hari['zak_standar'] ?? null" class="grup-awal" />
                                            <x-recording.sel :nilai="$hari['zak_standar_kumulatif'] ?? null" />
                                            <x-recording.sel :nilai="$hari['pakan_gram_standar']" />
                                            <x-recording.sel :nilai="$hari['pakan_gram_standar_kumulatif']" />
                                            <x-recording.sel :nilai="$hari['zak'] ?? null" masukan />
                                            <x-recording.sel :nilai="$hari['zak_kumulatif'] ?? null" />
                                            <x-recording.sel :nilai="$hari['pakan_gram'] ?? null" />
                                            <x-recording.sel :nilai="$hari['pakan_gram_kumulatif'] ?? null" />
                                            <x-recording.sel :nilai="$hari['selisih_zak'] ?? null" />
                                            <x-recording.sel :nilai="$hari['selisih_pakan_gram'] ?? null" />

                                            <x-recording.sel :nilai="$hari['abw_standar']" class="grup-awal" />
                                            <x-recording.sel :nilai="$hari['dg_standar']" />
                                            <x-recording.sel :nilai="$hari['abw'] ?? null" masukan />
                                            <x-recording.sel :nilai="$hari['dg'] ?? null" />
                                            <x-recording.sel :nilai="$hari['dg_kumulatif'] ?? null" />
                                            <x-recording.sel :nilai="$hari['abw_persen_standar'] ?? null" akhiran="%" />
                                            <x-recording.sel :nilai="$hari['selisih_abw'] ?? null" />
                                            <x-recording.sel :nilai="$hari['selisih_dg'] ?? null" />

                                            <x-recording.sel :nilai="$hari['persen_pakan_bw_standar']" akhiran="%" class="grup-awal" />
                                            <x-recording.sel :nilai="$hari['persen_pakan_bw'] ?? null" akhiran="%" />

                                            <x-recording.sel :nilai="$hari['fcr_standar']" :desimal="3" class="grup-awal" />
                                            <x-recording.sel :nilai="$hari['fcr'] ?? null" :desimal="3" />
                                            <x-recording.sel :nilai="$hari['selisih_fcr'] ?? null" :desimal="3" />

                                            <x-recording.sel :nilai="$hari['saldo']" class="grup-awal fw-500" />
                                        </tr>

                                        @if ($hari['umur'] % 7 === 0)
                                            <tr class="recording-minggu">
                                                <th scope="row" class="recording-lekat-1" colspan="2">Minggu {{ \App\Support\Format::romawi(intdiv($hari['umur'], 7)) }}</th>
                                                <td colspan="30"></td>
                                            </tr>
                                        @endif
                                    @endforeach
                                </tbody>
                            </table>
                        </div>

                        <p class="fs-12 color-gray mt-15 mb-0">
                            Angka <span class="recording-masukan">ungu</span> diisi dari catatan harian (mati, afkir, pakan, ABW); kolom lain dihitung otomatis.
                            Angka dalam kurung berarti negatif. Konversi kg pakan memakai berat per zak pada master tiap jenis pakan.
                        </p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada kandang untuk direkam</h5>
                        <p class="color-gray mb-0">Lembar recording muncul setelah periode dibuat dan kandangnya diisi populasi awal.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>

    <x-memuat target="pilihKandang" teks="Memuat recording" cepat />
</div>
