<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Standar pemeliharaan per strain" :jejak="['Master data', 'Standar strain']">
            <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-standar-strain">Tambah strain</x-tombol.kepala>
        </x-breadcrumb>

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif
        @error('hapus')
            <div class="col-12">
                <x-peringatan warna="danger" class="mb-4">{{ $message }}</x-peringatan>
            </div>
        @enderror

        <div class="col-12 mb-4">
            <x-kartu subjudul="Bobot badan, konsumsi pakan, dan deplesi standar tiap umur. Dipakai grafik dashboard, recording harian, dan sampling bobot." badan="p-0">
                <div class="tabel-data">
                    <div class="table-responsive">
                        <table class="table mb-0 db-table">
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Strain</th>
                                    <th class="text-end">Umur standar</th>
                                    <th class="text-end">ABW akhir</th>
                                    <th class="text-end">Deplesi akhir</th>
                                    <th class="text-end">Dipakai</th>
                                    <th class="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($this->daftar as $strain)
                                    <tr wire:key="strain-{{ $strain->id }}">
                                        <td>{{ $loop->iteration }}</td>
                                        <td><div class="fw-medium">{{ $strain->nama }}</div></td>
                                        <td class="text-end">@angka($strain->harian->count()) hari</td>
                                        <td class="text-end">@angka($strain->harian->last()?->abw) g</td>
                                        <td class="text-end">@angka($strain->harian->last()?->deplesi_persen, 2)%</td>
                                        <td class="text-end">@angka($this->pemakaian[$strain->nama] ?? 0) periode</td>
                                        <td>
                                            <x-aksi.ikon :aksi="[
                                                ['kelas' => 'edit', 'label' => 'Ubah standar '.$strain->nama, 'click' => 'ubah('.$strain->id.')', 'modal' => '#modal-standar-strain'],
                                                ['kelas' => 'remove', 'label' => 'Hapus standar '.$strain->nama, 'click' => 'mintaHapus('.$strain->id.')', 'modal' => '#konfirmasi-hapus-standar-strain'],
                                            ]" />
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center text-body-secondary">Belum ada standar strain.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </x-kartu>
        </div>
    </div>

    <x-memuat target="simpan, hapus" teks="Menyimpan standar strain" />
    <x-konfirmasi id="konfirmasi-hapus-standar-strain" judul="Hapus standar strain?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="hapus">
        Standar strain {{ $namaHapus }} akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>

    <x-modal
        id="modal-standar-strain"
        ukuran="xl"
        :judul="$strainId ? 'Ubah standar strain' : 'Tambah standar strain'"
        x-on:tutup-modal-standar-strain.window="bootstrap.Modal.getInstance($el).hide()"
        submit="simpan">
        <x-masukan
            id="standar-strain-nama"
            label="Nama strain"
            maxlength="100"
            wire:model="nama"
            :kesalahan="$errors->first('nama')"
            placeholder="Contoh: Cobb 500"
            autocomplete="off" />

        @if ($errors->has('hari*'))
            <x-peringatan warna="danger">{{ $errors->first('hari') ?: collect($errors->get('hari.*'))->flatten()->first() }}</x-peringatan>
        @endif

        <div class="tabel-data">
            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Umur (hari)</th>
                            <th>ABW (g)</th>
                            <th>Pakan (g/ekor/hari)</th>
                            <th>Deplesi kumulatif (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($hari as $umur => $satu)
                            <tr wire:key="standar-hari-{{ $umur }}">
                                <td><div class="fw-medium">{{ $umur }}</div></td>
                                <td><x-masukan.ribuan properti="hari.{{ $umur }}.abw" :desimal="2" teks ukuran="sm" class="mb-0" :kesalahan="$errors->first('hari.'.$umur.'.abw') ? ' ' : null" aria-label="ABW umur {{ $umur }}" /></td>
                                <td><x-masukan ukuran="sm" class="mb-0" tipe="number" step="0.01" min="0" wire:model="hari.{{ $umur }}.pakan_gram" :kesalahan="$errors->first('hari.'.$umur.'.pakan_gram') ? ' ' : null" aria-label="Pakan umur {{ $umur }}" /></td>
                                <td><x-masukan ukuran="sm" class="mb-0" tipe="number" step="0.01" min="0" max="100" wire:model="hari.{{ $umur }}.deplesi_persen" :kesalahan="$errors->first('hari.'.$umur.'.deplesi_persen') ? ' ' : null" aria-label="Deplesi umur {{ $umur }}" /></td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>

        <div class="d-flex gap-2 mt-3">
            <x-tombol variasi="outlined" ikon="bi-plus-lg" wire:click="tambahHari" wire:loading.attr="disabled" wire:target="tambahHari">Tambah hari</x-tombol>
            <x-tombol variasi="outlined" warna="danger" ikon="bi-dash-lg" wire:click="kurangiHari" wire:loading.attr="disabled" wire:target="kurangiHari">Kurangi hari</x-tombol>
        </div>

        <x-slot:footer>
            <x-tombol.batal wire:click="batal" />
            @if ($strainId)
                <x-tombol wire:key="tombol-simpan-perubahan-strain" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-standar-strain" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
            @else
                <x-tombol tipe="submit" wire:key="tombol-simpan-baru-strain" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
            @endif
        </x-slot:footer>
    </x-modal>

    @if ($strainId)
        <x-konfirmasi id="konfirmasi-simpan-standar-strain" judul="Simpan perubahan standar strain?" aksi="simpan" tombol="Ya, simpan perubahan">
            Standar {{ $nama }} akan diperbarui. Grafik dashboard, recording harian, dan sampling bobot periode yang memakai strain ini ikut menghitung ulang.
        </x-konfirmasi>
    @endif
</div>
