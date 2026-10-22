<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Pakan dan stok" :jejak="['Produksi', 'Pakan dan stok']" />
        <x-periode-tertutup :periode="$this->periode" />

        @if ($this->log)
        @if ($pesan)
        <div class="col-12 mb-25">
            <x-peringatan warna="success" bisaDitutup="true">
                {{ $pesan }}
            </x-peringatan>
        </div>
        @endif

        {{-- Ringkasan angka dulu, lalu rinciannya di bawah --}}
        <div class="col-12">
            <x-pakan.ringkasan :ringkasan="$this->ringkasan" />
        </div>

        <div class="col-xxl-8 mb-25">
            <div class="card border-0 px-25 h-100">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Log harian pemberian pakan</h6>
                        <span class="fs-12 color-gray">Chick-in {{ $this->periode->tanggal_chick_in->translatedFormat('j F Y') }}</span>
                    </div>
                    <div class="card-extra">
                        @unless ($this->periode->tertutup())
                            <x-tombol ukuran="sm" wire:click="tambahPemberian" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPemberian, simpan">
                                Tambah pemberian
                            </x-tombol>
                        @endunless
                    </div>
                </div>
                <div class="card-body p-0 pb-25">
                    <div class="recording-gulung" tabindex="0" role="region" aria-label="Log harian pemberian pakan, bisa digulir">
                        <table class="table table-bordered tabel-recording tabel-log mb-0">
                            <thead>
                                <tr class="recording-kepala-1">
                                    <th>Tanggal</th>
                                    <th>Usia (hari)</th>
                                    <th>Jenis pakan</th>
                                    @foreach ($this->log['kandang'] as $nama)
                                    <th>{{ $nama }} (zak)</th>
                                    @endforeach
                                    <th>Total (kg)</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($this->log['hari'] as $hari)
                                @forelse ($hari['jenis'] as $pemberian)
                                <tr wire:key="log-{{ $hari['umur'] }}-{{ $loop->index }}">
                                    @if ($loop->first)
                                    <th scope="row" rowspan="{{ count($hari['jenis']) }}">{{ $hari['tanggal']->translatedFormat('D, j M Y') }}</th>
                                    <td rowspan="{{ count($hari['jenis']) }}">{{ $hari['umur'] }}</td>
                                    @endif
                                    <td class="recording-masukan">{{ $pemberian['jenis'] ?? '-' }}</td>
                                    @foreach ($this->log['kandang'] as $id => $nama)
                                    <td>
                                        @isset($pemberian['zak'][$id])
                                        @angka($pemberian['zak'][$id], 1)
                                        @else
                                        -
                                        @endisset
                                    </td>
                                    @endforeach
                                    <td class="fw-600">@angka($pemberian['berat_kg'], 1)</td>
                                    <td>
                                        @php
                                            $aksiCatatan = [];
                                            foreach ($this->log['kandang'] as $id => $nama) {
                                                foreach ($pemberian['catatan'][$id] ?? [] as $catatan) {
                                                    $aksiCatatan[] = ['kelas' => 'edit', 'label' => 'Ubah pemberian pakan '.$catatan['id'], 'click' => 'ubahPemberian('.$catatan['id'].')', 'modal' => '#modal-form-pakan'];
                                                    $aksiCatatan[] = ['kelas' => 'remove', 'label' => 'Hapus pemberian pakan '.$catatan['id'], 'click' => 'mintaHapusPemberian('.$catatan['id'].')', 'modal' => '#konfirmasi-hapus-pakan'];
                                                }
                                            }
                                        @endphp
                                        <x-aksi.ikon :aksi="$aksiCatatan" />
                                    </td>
                                </tr>
                                @empty
                                <tr wire:key="log-{{ $hari['umur'] }}-kosong" class="recording-belum">
                                    <th scope="row">{{ $hari['tanggal']->translatedFormat('D, j M Y') }}</th>
                                    <td>{{ $hari['umur'] }}</td>
                                    <td>-</td>
                                    @foreach ($this->log['kandang'] as $nama)
                                    <td>-</td>
                                    @endforeach
                                    <td>-</td>
                                    <td>-</td>
                                </tr>
                                @endforelse
                                @endforeach
                            </tbody>
                            <tfoot>
                                <tr class="recording-minggu">
                                    <th scope="row" colspan="3">Total</th>
                                    @foreach ($this->log['kandang'] as $id => $nama)
                                    <td>@angka($this->log['total_kandang'][$id], 1)</td>
                                    @endforeach
                                    <td>@angka($this->log['total_kg'], 1)</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xxl-4 mb-25">
            <div class="card border-0 px-25 mb-25">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Sisa pakan per jenis</h6>
                        <span class="fs-12 color-gray">Pakan masuk dikurangi pemberian.</span>
                    </div>
                </div>
                <div class="card-body p-0 pb-25">
                    <x-pakan.stok :stok="$this->log['per_jenis']" />
                    <p class="fs-12 color-gray mt-15 mb-0">Konversi kg memakai berat per zak pada master tiap jenis pakan. Pemberian tanpa jenis memakai standar @angka(config('standar.kg_per_zak')) kg/zak.</p>
                </div>
            </div>

            <div class="card border-0 px-25">
                <div class="card-header px-0 border-0">
                    <div>
                        <h6>Daftar pakan masuk</h6>
                    </div>
                    @unless ($this->periode->tertutup())
                        <x-tombol ukuran="sm" wire:click="tambahPenerimaan" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPenerimaan, simpan">
                            Tambah pakan masuk
                        </x-tombol>
                    @endunless
                </div>
                <div class="card-body p-0 pb-25">
                    <div class="table-responsive">
                        <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Jenis pakan</th>
                                    <th class="text-end">Jumlah (zak)</th>
                                    <th class="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->daftarPenerimaan as $penerimaan)
                                <tr wire:key="penerimaan-pakan-{{ $penerimaan->id }}">
                                    <td>{{ $penerimaan->tanggal->translatedFormat('j M Y') }}</td>
                                    <td>{{ $penerimaan->jenisPakan?->kode ?? 'Tidak diketahui' }}</td>
                                    <td class="text-end">{{ \App\Support\Format::ringkasKurung($penerimaan->zak) }}</td>
                                    <td class="text-end">
                                        @unless ($this->periode->tertutup())
                                            <x-aksi.ikon :aksi="[
                                                ['kelas' => 'edit', 'label' => 'Ubah pakan masuk '.$penerimaan->jenisPakan?->kode.' '.$penerimaan->tanggal->translatedFormat('j F Y'), 'click' => 'ubahPenerimaan('.$penerimaan->id.')', 'modal' => '#modal-form-pakan'],
                                                ['kelas' => 'remove', 'label' => 'Hapus pakan masuk '.$penerimaan->jenisPakan?->kode.' '.$penerimaan->tanggal->translatedFormat('j F Y'), 'click' => 'mintaHapusPenerimaan('.$penerimaan->id.')', 'modal' => '#konfirmasi-hapus-pakan'],
                                            ]" />
                                        @endunless
                                    </td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="4" class="text-center py-30 color-gray">Belum ada pakan masuk.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        @else
        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <h5 class="mb-10">Belum ada periode</h5>
                    <p class="color-gray mb-0">Log pemberian pakan muncul setelah periode dibuat dan kandangnya diisi.</p>
                </div>
            </div>
        </div>
        @endif
    </div>

    @if ($this->log)
    <x-modal
        id="modal-form-pakan"
        :judul="($catatanId ? 'Ubah ' : 'Tambah ') . ($tipeForm === 'penerimaan' ? 'pakan masuk' : 'pemberian pakan')"
        ukuran="lg"
        x-on:tutup-modal-pakan.window="bootstrap.Modal.getInstance($el).hide()" submit="simpan">

            <div class="row">
                <div class="col-md-6">
                    <x-masukan
                        id="pakan-tanggal"
                        label="Tanggal"
                        tipe="date"
                        min="{{ $this->batasTanggal['min'] }}"
                        max="{{ $this->batasTanggal['max'] }}"
                        wire:model="tanggal"
                        :kesalahan="$errors->first('tanggal')" />
                </div>
                <div class="col-md-6 mb-25">
                    <label for="pakan-jenis" class="il-gray fs-14 fw-500 mb-10">Jenis pakan</label>
                    <select
                        id="pakan-jenis"
                        wire:model="jenisPakanId"
                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid'=> $errors->has('jenisPakanId')])
                        >
                        <option value="">Tidak diketahui / belum dicatat</option>
                        @foreach ($this->daftarJenisPakan as $jenisPakan)
                        <option value="{{ $jenisPakan->id }}">{{ $jenisPakan->kode }}</option>
                        @endforeach
                    </select>
                    @error('jenisPakanId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                @if ($tipeForm === 'pemberian')
                <div class="col-md-6 mb-25">
                    <label for="pakan-kandang" class="il-gray fs-14 fw-500 mb-10">Kandang</label>
                    <select
                        id="pakan-kandang"
                        wire:model="periodeKandangId"
                        @class(['form-control ih-medium ip-gray radius-xs b-light px-15', 'is-invalid'=> $errors->has('periodeKandangId')])
                        >
                        <option value="">Pilih kandang</option>
                        @foreach ($this->daftarKandang as $kandang)
                        <option value="{{ $kandang->id }}">{{ $kandang->kandang->nama }}</option>
                        @endforeach
                    </select>
                    @error('periodeKandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                @endif
                <div class="col-md-6">
                    <x-masukan
                        id="pakan-zak"
                        label="Jumlah (zak)"
                        tipe="number"
                        min="0.1"
                        max="9999999.9"
                        step="0.1"
                        wire:model="zak"
                        :kesalahan="$errors->first('zak')"
                        placeholder="Contoh: 25" />
                </div>
            </div>

            <x-slot:footer>
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="batal">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            </x-slot:footer>
        </x-modal>
    <x-memuat target="simpan, hapus" teks="Menyimpan catatan pakan" />
    <x-konfirmasi id="konfirmasi-hapus-pakan" judul="Hapus catatan pakan?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        {{ $catatanHapus }} akan dihapus. Perubahan ini juga mengubah perhitungan stok. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
    @endif
</div>
