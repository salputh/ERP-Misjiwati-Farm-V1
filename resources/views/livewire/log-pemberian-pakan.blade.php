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
        <x-pakan.ringkasan :ringkasan="$this->ringkasan" />

        <div class="col-xxl-8 mb-25">
            <x-kartu judul="Log harian pemberian pakan" :subjudul="'Chick-in '.$this->periode->tanggal_chick_in->translatedFormat('j F Y')" class="h-100">
                @unless ($this->periode->tertutup())
                    <x-slot:ekstra>
                        <x-tombol wire:click="tambahPemberian" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPemberian, simpan">Tambah pemberian</x-tombol>
                    </x-slot:ekstra>
                @endunless

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
                                        @foreach ($this->log['kandang'] as $id => $nama)
                                            @foreach ($pemberian['catatan'][$id] ?? [] as $catatan)
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'edit', 'label' => 'Ubah pemberian pakan '.$catatan['id'], 'click' => 'ubahPemberian('.$catatan['id'].')', 'modal' => '#modal-form-pakan'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus pemberian pakan '.$catatan['id'], 'click' => 'mintaHapusPemberian('.$catatan['id'].')', 'modal' => '#konfirmasi-hapus-pakan'],
                                                ]" />
                                            @endforeach
                                        @endforeach
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
            </x-kartu>
        </div>

        <div class="col-xxl-4 mb-25">
            <x-kartu judul="Sisa pakan per jenis" subjudul="Pakan masuk dikurangi pemberian." class="mb-25" badan="p-0">
                <div class="table4 p-25">
                    <x-pakan.stok :stok="$this->log['per_jenis']" />
                    <p class="fs-13 color-light mt-15 mb-0">Konversi kg memakai berat per zak pada master tiap jenis pakan. Pemberian tanpa jenis memakai standar @angka(config('standar.kg_per_zak')) kg/zak.</p>
                </div>
            </x-kartu>

            <x-kartu judul="Daftar pakan masuk" badan="p-0">
                @unless ($this->periode->tertutup())
                    <x-slot:ekstra>
                        <x-tombol wire:click="tambahPenerimaan" data-bs-toggle="modal" data-bs-target="#modal-form-pakan" wire:loading.attr="disabled" wire:target="tambahPenerimaan, simpan">Tambah pakan masuk</x-tombol>
                    </x-slot:ekstra>
                @endunless
                <div class="table4 p-25">
                    <div class="table-responsive">
                        <table class="table mb-0">
                            <thead>
                                <tr class="userDatatable-header">
                                    <th><span class="userDatatable-title">Tanggal</span></th>
                                    <th><span class="userDatatable-title">Jenis pakan</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Jumlah (zak)</span></th>
                                    <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->daftarPenerimaan as $penerimaan)
                                    <tr wire:key="penerimaan-pakan-{{ $penerimaan->id }}">
                                        <td><div class="userDatatable-content">{{ $penerimaan->tanggal->translatedFormat('j M Y') }}</div></td>
                                        <td><div class="userDatatable-content">{{ $penerimaan->jenisPakan?->kode ?? 'Tidak diketahui' }}</div></td>
                                        <td class="text-end"><div class="userDatatable-content">{{ \App\Support\Format::ringkasKurung($penerimaan->zak) }}</div></td>
                                        <td>
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
                                        <td colspan="4" class="text-center color-light">Belum ada pakan masuk.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </x-kartu>
        </div>
        @else
        <x-kosong judul="Belum ada periode">Log pemberian pakan muncul setelah periode dibuat dan kandangnya diisi.</x-kosong>
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
                    <div class="form-group mb-25">
                        <label for="pakan-tanggal" class="il-gray fs-14 fw-500 align-center mb-10">Tanggal</label>
                        <x-pilih-tanggal id="pakan-tanggal" ukuran="medium" :nilai="$tanggal" :min="$this->batasTanggal['min']" :maks="$this->batasTanggal['max']" :kesalahan="$errors->has('tanggal')" x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)" />
                        @error('tanggal')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group mb-25">
                        <label class="il-gray fs-14 fw-500 align-center mb-10">Jenis pakan</label>
                        <x-pilih bentuk="isian" nama="Jenis pakan" :label="$this->daftarJenisPakan->firstWhere('id', (int) $jenisPakanId)?->kode ?? 'Tidak diketahui / belum dicatat'" :kesalahan="$errors->has('jenisPakanId')">
                            <button type="button" wire:click="$set('jenisPakanId', '')" @class(['dropdown-item', 'active' => $jenisPakanId === ''])>Tidak diketahui / belum dicatat</button>
                            @foreach ($this->daftarJenisPakan as $jenisPakan)
                                <button type="button" wire:click="$set('jenisPakanId', '{{ $jenisPakan->id }}')" @class(['dropdown-item', 'active' => (int) $jenisPakanId === $jenisPakan->id])>{{ $jenisPakan->kode }}</button>
                            @endforeach
                        </x-pilih>
                        @error('jenisPakanId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                @if ($tipeForm === 'pemberian')
                    <div class="col-md-6">
                        <div class="form-group mb-25">
                            <label class="il-gray fs-14 fw-500 align-center mb-10">Kandang</label>
                            <x-pilih bentuk="isian" nama="Kandang" :label="$this->daftarKandang->firstWhere('id', (int) $periodeKandangId)?->kandang->nama ?? 'Pilih kandang'" :kesalahan="$errors->has('periodeKandangId')">
                                @foreach ($this->daftarKandang as $kandang)
                                    <button type="button" wire:click="$set('periodeKandangId', '{{ $kandang->id }}')" @class(['dropdown-item', 'active' => (int) $periodeKandangId === $kandang->id])>{{ $kandang->kandang->nama }}</button>
                                @endforeach
                            </x-pilih>
                            @error('periodeKandangId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
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
                <x-tombol.batal wire:click="batal" />
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            </x-slot:footer>
        </x-modal>
    <x-memuat target="simpan, hapus" teks="Menyimpan catatan pakan" />
    <x-konfirmasi id="konfirmasi-hapus-pakan" judul="Hapus catatan pakan?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        {{ $catatanHapus }} akan dihapus. Perubahan ini juga mengubah perhitungan stok. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
    @endif
</div>
