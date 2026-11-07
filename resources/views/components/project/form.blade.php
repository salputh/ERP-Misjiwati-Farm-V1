@props(['ubah', 'status', 'tanggalMulai', 'tanggalSelesai', 'anggotaTerpilih', 'karyawan', 'kelompok', 'kategori'])

{{-- Modal buat dan ubah project (modal Bootstrap/Basalt): isian tanpa label di atas, status berupa pilihan berderet, anggota project dengan avatar, tanggal mulai dan selesai berdampingan, lalu tombol di dalam badan modal.
     Daftar anggota bisa disaring per kandang; pilihan yang tersembunyi tetap tercentang.
     Menyimpan perubahan project tersimpan lewat modal konfirmasi #konfirmasi-simpan-project. --}}
<div
    class="modal fade"
    id="modal-project"
    role="dialog"
    tabindex="-1"
    aria-labelledby="modal-project-judul"
    aria-hidden="true"
    wire:ignore.self
    x-on:tutup-modal-project.window="bootstrap.Modal.getInstance($el)?.hide()"
>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h2 class="modal-title h6" id="modal-project-judul">{{ $ubah ? 'Ubah project' : 'Buat project' }}</h2>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
            </div>
            <div class="modal-body">
                <form wire:submit="simpan" id="form-project">
                        <div class="mb-3">
                            <label for="project-nama" class="visually-hidden">Nama project</label>
                            <input id="project-nama" type="text" maxlength="180" autocomplete="off" placeholder="Nama project" wire:model="nama" @class(['form-control', 'is-invalid' => $errors->has('nama')])>
                            @error('nama')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                        <div class="mb-3">
                            <label for="project-kategori" class="visually-hidden">Kategori project</label>
                            <input id="project-kategori" type="text" maxlength="80" autocomplete="off" placeholder="Kategori project, misalnya Perawatan" list="project-kategori-pilihan" wire:model="kategori" @class(['form-control', 'is-invalid' => $errors->has('kategori')])>
                            <datalist id="project-kategori-pilihan">
                                @foreach (['Produksi', 'Operasional', 'Perawatan', 'Administrasi'] as $saran)
                                    <option value="{{ $saran }}"></option>
                                @endforeach
                                @foreach ($kategori as $saran)
                                    <option value="{{ $saran }}"></option>
                                @endforeach
                            </datalist>
                            @error('kategori')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                        <div class="mb-3">
                            <label for="project-deskripsi" class="visually-hidden">Deskripsi project</label>
                            <textarea id="project-deskripsi" rows="3" maxlength="3000" placeholder="Deskripsi project" wire:model="deskripsi" @class(['form-control', 'is-invalid' => $errors->has('deskripsi')])></textarea>
                            @error('deskripsi')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                        <div class="mb-3">
                            <label class="mb-3" id="project-status-label">Status</label>
                            <div class="d-flex flex-wrap" role="radiogroup" aria-labelledby="project-status-label">
                                @foreach (\App\Livewire\Projects::STATUS as $kode => $label)
                                    <div class="form-check me-4 mb-2" wire:key="status-project-{{ $kode }}">
                                        <input class="form-check-input" type="radio" name="project-status" id="project-status-{{ $kode }}" value="{{ $kode }}" wire:model="status">
                                        <label for="project-status-{{ $kode }}" class="form-check-label">
                                            {{ $label }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                            @error('status')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                        <div class="mb-4" x-data="{ kandang: 'semua' }">
                            <div class="mb-3 mb-2">
                                <label id="project-anggota-label" class="form-label">Anggota project</label>
                            </div>
                            @if ($karyawan->isNotEmpty())
                                <ul class="d-flex flex-wrap mb-3 list-unstyled gap-1 p-0" aria-label="Anggota terpilih">
                                    @foreach ($karyawan->whereIn('id', $anggotaTerpilih) as $anggota)
                                        <li wire:key="anggota-terpilih-{{ $anggota->id }}">
                                            <span class="rounded-circle lingkar-34 bg-primary-subtle text-primary small fw-medium d-flex align-items-center justify-content-center" title="{{ $anggota->nama }}">{{ $anggota->inisial() }}</span>
                                        </li>
                                    @endforeach
                                </ul>
                                <div class="btn-group flex-wrap mb-3" role="group" aria-label="Saring anggota per kandang">
                                    <button type="button" class="btn btn-sm btn-outline-secondary active" :class="{ 'active': kandang === 'semua' }" :aria-pressed="kandang === 'semua'" x-on:click="kandang = 'semua'">Semua ({{ $karyawan->count() }})</button>
                                    @foreach ($kelompok as $saringan)
                                        <button type="button" class="btn btn-sm btn-outline-secondary" :class="{ 'active': kandang === '{{ $saringan['kunci'] }}' }" :aria-pressed="kandang === '{{ $saringan['kunci'] }}'" x-on:click="kandang = '{{ $saringan['kunci'] }}'" wire:key="saring-anggota-{{ $saringan['kunci'] }}">{{ $saringan['label'] }} ({{ $saringan['jumlah'] }})</button>
                                    @endforeach
                                </div>
                                <div class="project-anggota-pilihan border px-3 pt-3" role="group" aria-labelledby="project-anggota-label">
                                    @foreach ($karyawan as $anggota)
                                        <div class="form-check mb-3" wire:key="pilih-anggota-{{ $anggota->id }}" x-show="kandang === 'semua' || kandang === '{{ $anggota->kandang_id ?? 'tanpa' }}'">
                                            <input class="form-check-input" type="checkbox" id="anggota-{{ $anggota->id }}" value="{{ $anggota->id }}" wire:model.live="anggotaTerpilih">
                                            <label for="anggota-{{ $anggota->id }}" class="form-check-label">
                                                
                                                    {{ $anggota->nama }}
                                                    <span class="small text-body-secondary">· {{ $anggota->jabatan->label() }}{{ $anggota->kandang ? ' · '.$anggota->kandang->nama : '' }}
                                                </span>
                                            </label>
                                        </div>
                                    @endforeach
                                </div>
                            @else
                                <p class="small text-body-secondary mb-0">Belum ada karyawan yang dapat ditambahkan sebagai anggota.</p>
                            @endif
                            @error('anggotaTerpilih.*')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                        </div>
                        <div class="d-flex">
                            <div class="mb-3 w-100 me-sm-3">
                                <label for="project-tanggal-mulai" class="form-label">Tanggal mulai</label>
                                <x-pilih-tanggal id="project-tanggal-mulai" ukuran="medium" :nilai="$tanggalMulai" :kesalahan="$errors->has('tanggalMulai')" x-on:tanggal-dipilih="$wire.set('tanggalMulai', $event.detail)" />
                                @error('tanggalMulai')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                            <div class="mb-3 w-100">
                                <label for="project-tanggal-selesai" class="form-label">Target selesai</label>
                                <x-pilih-tanggal id="project-tanggal-selesai" ukuran="medium" :nilai="$tanggalSelesai" :kesalahan="$errors->has('tanggalSelesai')" x-on:tanggal-dipilih="$wire.set('tanggalSelesai', $event.detail)" />
                                @error('tanggalSelesai')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                            </div>
                        </div>
                        <div class="d-flex gap-2 pt-4">
                            @if ($ubah)
                                <x-tombol ukuran="default" class="text-capitalize" wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-project" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
                            @else
                                <x-tombol tipe="submit" ukuran="default" class="text-capitalize" wire:key="tombol-simpan-baru" wire:loading.attr="disabled" wire:target="simpan">Tambah project</x-tombol>
                            @endif
                            <x-tombol warna="light" ukuran="default" class="fw-normal text-body-secondary" data-bs-dismiss="modal">Batal</x-tombol>
                        </div>
                    </form>
            </div>
        </div>
    </div>
</div>

@if ($ubah)
    <x-konfirmasi id="konfirmasi-simpan-project" judul="Simpan perubahan project?" aksi="simpan" tombol="Ya, simpan perubahan">
        Nama, kategori, status, tanggal, atau anggota project ini akan diperbarui.
    </x-konfirmasi>
@endif
