<div>
    <div class="container-fluid">
        <div class="row">
            <x-breadcrumb judul="Project" :jejak="['Project']">
                <div class="d-flex flex-wrap align-items-center justify-content-center gap-3 me-20">
                    <span class="fs-13 color-gray">{{ $this->statistik['berjalan'] }} project berjalan</span>
                    <x-tombol ukuran="sm" ikon="uil-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">
                        Buat project
                    </x-tombol>
                </div>
            </x-breadcrumb>

            @if ($pesan)
                <div class="col-12">
                    <x-peringatan warna="success" class="mb-20">{{ $pesan }}</x-peringatan>
                </div>
            @endif

            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->statistik['total'])" label="Semua project" ikon="uil-apps" warna="primary">
                <small>{{ \App\Support\Format::angka($this->statistik['anggota']) }} karyawan tersedia</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->statistik['berjalan'])" label="Sedang berjalan" ikon="uil-sync" warna="info">
                <small>{{ \App\Support\Format::angka($this->statistik['tugas_aktif']) }} tugas aktif</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->statistik['selesai'])" label="Selesai" ikon="uil-check-circle" warna="success">
                <small>{{ \App\Support\Format::angka($this->statistik['tugas_selesai']) }} tugas dituntaskan</small>
            </x-dashboard.kartu>
            <x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::angka($this->statistik['terlambat'])" label="Terlambat" ikon="uil-clock" warna="danger">
                <small>Lewat target penyelesaian</small>
            </x-dashboard.kartu>

            <div class="col-12">
                <div class="project-top-wrapper project-top-progress d-flex justify-content-between flex-wrap">
                    <div class="project-top-left d-flex flex-wrap justify-content-lg-between justify-content-center mt-n10">
                        <div class="project-tap global-shadow order-lg-1 order-2 my-10">
                            <div class="nav px-1" role="tablist" aria-label="Filter status project">
                                @foreach (['all' => 'Semua', 'in_progress' => 'Berjalan', 'planned' => 'Direncanakan', 'completed' => 'Selesai', 'overdue' => 'Terlambat'] as $kode => $label)
                                    <button type="button" class="nav-link {{ $filterStatus === $kode ? 'active' : '' }}" wire:click="$set('filterStatus', '{{ $kode }}')" aria-pressed="{{ $filterStatus === $kode ? 'true' : 'false' }}">{{ $label }}</button>
                                @endforeach
                            </div>
                        </div>
                        <div class="project-search project-search--height global-shadow ms-md-20 my-10 order-md-2 order-1">
                            <label class="visually-hidden" for="cari-project">Cari project</label>
                            <div class="d-flex align-items-center">
                                <i class="uil uil-search ms-15 color-gray" aria-hidden="true"></i>
                                <input id="cari-project" class="form-control me-sm-2 border-0 box-shadow-none" type="search" placeholder="Cari nama project" wire:model.live.debounce.300ms="cari">
                            </div>
                        </div>
                    </div>
                    <div class="project-top-right d-flex flex-wrap align-items-center">
                        <label for="filter-kategori" class="mb-0 me-10 fs-14 color-gray">Kategori</label>
                        <select id="filter-kategori" class="form-control form-control-sm" wire:model.live="filterKategori">
                            <option value="all">Semua kategori</option>
                            @foreach ($this->kategoriProyek as $kategoriProject)
                                <option value="{{ $kategoriProject }}">{{ $kategoriProject }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="row mt-20">
                    @forelse ($this->projects as $project)
                        @php
                            $terlambat = $project->tanggal_selesai?->lt(today()) && ! in_array($project->status, ['completed', 'on_hold'], true);
                            $jumlahTugas = $project->tugas_count;
                            $tugasSelesai = $project->tugas_selesai_count;
                            $progres = $jumlahTugas > 0 ? (int) round($tugasSelesai / $jumlahTugas * 100) : 0;
                        @endphp
                        <div class="col-xl-4 col-md-6 mb-25" wire:key="project-{{ $project->id }}">
                            <article class="user-group radius-xl bg-white media-ui pt-25 pb-25 h-100">
                                <div class="border-bottom px-25 pb-20">
                                    <div class="d-flex justify-content-between align-items-start gap-2">
                                        <div class="text-capitalize">
                                            <span class="dm-tag tag-transparented tag-primary mb-10">{{ $project->kategori }}</span>
                                            <h6 class="fw-500 user-group media-ui__title mb-5">{{ $project->nama }}</h6>
                                        </div>
                                        <div class="dropdown">
                                            <button type="button" class="btn-link border-0 bg-transparent p-0" data-bs-toggle="dropdown" aria-label="Aksi project {{ $project->nama }}" aria-expanded="false">
                                                <i class="uil uil-ellipsis-h fs-20" aria-hidden="true"></i>
                                            </button>
                                            <div class="dropdown-menu dropdown-menu-end">
                                                <button type="button" class="dropdown-item" wire:click="bukaTugas({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#modal-project-tugas">Kelola tugas</button>
                                                <button type="button" class="dropdown-item" wire:click="ubah({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#modal-project">Ubah project</button>
                                                <button type="button" class="dropdown-item text-danger" wire:click="mintaHapusProject({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-project">Hapus project</button>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="fs-13 color-gray mb-20">{{ $project->deskripsi ?: 'Belum ada deskripsi project.' }}</p>
                                    <div class="d-flex justify-content-between align-items-center mb-10">
                                        <span @class(['media-badge', 'text-uppercase', 'color-white', 'bg-danger' => $terlambat, 'bg-success' => ! $terlambat && $project->status === 'completed', 'bg-warning' => ! $terlambat && $project->status === 'on_hold', 'bg-primary' => ! $terlambat && in_array($project->status, ['planned', 'in_progress'], true)])>
                                            {{ $terlambat ? 'Terlambat' : \App\Livewire\Projects::STATUS[$project->status] }}
                                        </span>
                                        <span class="fs-12 color-gray">{{ $tugasSelesai }} / {{ $jumlahTugas }} tugas</span>
                                    </div>
                                    <div class="user-group-progress-bar">
                                        <div class="progress-wrap d-flex align-items-center mb-0">
                                            <div class="progress" role="progressbar" aria-label="Progres {{ $project->nama }}" aria-valuenow="{{ $progres }}" aria-valuemin="0" aria-valuemax="100">
                                                <div class="progress-bar bg-primary" style="width: {{ $progres }}%"></div>
                                            </div>
                                            <span class="progress-percentage">{{ $progres }}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="px-25 pt-20">
                                    <div class="d-flex justify-content-between gap-3 mb-15">
                                        <div>
                                            <span class="d-block color-gray fs-12">Tanggal mulai</span>
                                            <span class="fs-13 fw-500">{{ $project->tanggal_mulai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</span>
                                        </div>
                                        <div class="text-end">
                                            <span class="d-block color-gray fs-12">Target selesai</span>
                                            <span @class(['fs-13', 'fw-500', 'color-danger' => $terlambat])>{{ $project->tanggal_selesai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</span>
                                        </div>
                                    </div>
                                    <p class="fs-12 color-gray mb-10">Anggota project</p>
                                    @if ($project->anggota->isNotEmpty())
                                        <ul class="d-flex flex-wrap user-group-people__parent mb-15">
                                            @foreach ($project->anggota->take(5) as $anggota)
                                                @php
                                                    $inisial = collect(explode(' ', $anggota->nama))->take(2)->map(fn ($kata) => mb_substr($kata, 0, 1))->implode('');
                                                @endphp
                                                <li wire:key="anggota-{{ $project->id }}-{{ $anggota->id }}">
                                                    <span class="project-member-avatar" title="{{ $anggota->nama }}" aria-label="{{ $anggota->nama }}">{{ $inisial }}</span>
                                                </li>
                                            @endforeach
                                            @if ($project->anggota->count() > 5)
                                                <li><span class="project-member-avatar project-member-avatar--more">+{{ $project->anggota->count() - 5 }}</span></li>
                                            @endif
                                        </ul>
                                    @else
                                        <span class="d-block fs-12 color-gray mb-15">Belum ada anggota</span>
                                    @endif
                                    <button type="button" class="btn btn-outline-primary btn-xs btn-squared" wire:click="bukaTugas({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#modal-project-tugas">
                                        Lihat tugas
                                    </button>
                                </div>
                            </article>
                        </div>
                    @empty
                        <div class="col-12">
                            <div class="card border-0">
                                <div class="card-body text-center py-50">
                                    <i class="uil uil-folder-open fs-40 color-gray" aria-hidden="true"></i>
                                    <h6 class="mt-15 mb-5">{{ $cari || $filterStatus !== 'all' || $filterKategori !== 'all' ? 'Project tidak ditemukan' : 'Belum ada project' }}</h6>
                                    <p class="color-gray mb-20">{{ $cari || $filterStatus !== 'all' || $filterKategori !== 'all' ? 'Ubah pencarian atau filter untuk melihat project lainnya.' : 'Buat project pertama untuk mulai mengelola pekerjaan dan tugas.' }}</p>
                                    @if (! $cari && $filterStatus === 'all' && $filterKategori === 'all')
                                        <x-tombol ukuran="sm" ikon="uil-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">Buat project</x-tombol>
                                    @endif
                                </div>
                            </div>
                        </div>
                    @endforelse
                </div>
            </div>
        </div>
    </div>

    <x-memuat target="simpan, hapusProject, simpanTugas, ubahStatusTugas, hapusTugas" teks="Memperbarui project" />

    <div class="modal-basic modal fade" id="modal-project" tabindex="-1" role="dialog" aria-labelledby="modal-project-title" aria-hidden="true" wire:ignore.self x-on:tutup-modal-project.window="bootstrap.Modal.getInstance($el).hide()">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" role="document">
            <div class="modal-content modal-bg-white">
                <div class="modal-header">
                    <h6 class="modal-title" id="modal-project-title">{{ $projectId ? 'Ubah project' : 'Buat project baru' }}</h6>
                    <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup" wire:click="tambah">
                        <i class="uil uil-times" aria-hidden="true"></i>
                    </button>
                </div>
        <form wire:submit="simpan">
            <div class="modal-body">
            <div class="row">
                <div class="col-12">
                    <x-masukan id="project-nama" label="Nama project" maxlength="180" wire:model="nama" :kesalahan="$errors->first('nama')" placeholder="Contoh: Perbaikan ventilasi kandang" autocomplete="off" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="project-kategori" label="Kategori" maxlength="80" wire:model="kategori" :kesalahan="$errors->first('kategori')" placeholder="Produksi, operasional, perawatan" list="project-kategori-options" autocomplete="off" />
                    <datalist id="project-kategori-options">
                        @foreach (['Produksi', 'Operasional', 'Perawatan', 'Administrasi'] as $kategori)
                            <option value="{{ $kategori }}"></option>
                        @endforeach
                        @foreach ($this->kategoriProyek as $kategori)
                            <option value="{{ $kategori }}"></option>
                        @endforeach
                    </datalist>
                </div>
                <div class="col-md-6">
                    <label for="project-status" class="il-gray fs-14 fw-500 mb-10">Status</label>
                    <select id="project-status" class="form-control form-control-default @error('status') is-invalid @enderror" wire:model="status">
                        @foreach (\App\Livewire\Projects::STATUS as $kode => $label)
                            <option value="{{ $kode }}">{{ $label }}</option>
                        @endforeach
                    </select>
                    @error('status')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="col-12">
                    <label for="project-deskripsi" class="il-gray fs-14 fw-500 mb-10">Deskripsi</label>
                    <textarea id="project-deskripsi" rows="3" maxlength="3000" class="form-control radius-xs b-light px-15 @error('deskripsi') is-invalid @enderror" wire:model="deskripsi" placeholder="Tujuan dan ruang lingkup project"></textarea>
                    @error('deskripsi')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="col-md-6">
                    <x-masukan id="project-tanggal-mulai" label="Tanggal mulai" tipe="date" wire:model="tanggalMulai" :kesalahan="$errors->first('tanggalMulai')" />
                </div>
                <div class="col-md-6">
                    <x-masukan id="project-tanggal-selesai" label="Target selesai" tipe="date" wire:model="tanggalSelesai" :kesalahan="$errors->first('tanggalSelesai')" />
                </div>
                <div class="col-12">
                    <span class="il-gray fs-14 fw-500 d-block mb-10">Anggota project</span>
                    @if ($this->karyawan->isNotEmpty())
                        <div class="row">
                            @foreach ($this->karyawan as $anggota)
                                <div class="col-md-6 mb-10" wire:key="pilih-anggota-{{ $anggota->id }}">
                                    <label class="project-member-choice">
                                        <input type="checkbox" value="{{ $anggota->id }}" wire:model="anggotaTerpilih">
                                        <span>{{ $anggota->nama }}</span>
                                        <small>{{ $anggota->jabatan->label() }}{{ $anggota->kandang ? ' · '.$anggota->kandang->nama : '' }}</small>
                                    </label>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <p class="fs-12 color-gray mb-0">Belum ada karyawan yang dapat ditambahkan sebagai anggota.</p>
                    @endif
                    @error('anggotaTerpilih.*')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
            </div>

            </div>
            <div class="modal-footer">
                <x-tombol tipe="button" warna="light" variasi="outlined" data-bs-dismiss="modal" wire:click="tambah">Batal</x-tombol>
                <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpan">
                    <span wire:loading.remove wire:target="simpan">Simpan project</span>
                    <span wire:loading wire:target="simpan">Menyimpan...</span>
                </x-tombol>
            </div>
        </form>
            </div>
        </div>
    </div>

    <div class="modal-basic modal fade" id="modal-project-tugas" tabindex="-1" role="dialog" aria-labelledby="modal-project-tugas-title" aria-hidden="true" wire:ignore.self>
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" role="document">
            <div class="modal-content modal-bg-white">
                <div class="modal-header">
                    <h6 class="modal-title" id="modal-project-tugas-title">{{ $this->projectAktif?->nama ?? 'Tugas project' }}</h6>
                    <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                        <i class="uil uil-times" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="modal-body">
        @php
            $project = $this->projectAktif;
            $tugas = $project?->tugas ?? collect();
            $anggota = $project?->anggota ?? collect();
            $tugasSelesai = $tugas->where('status', 'completed')->count();
            $jumlahTugas = $tugas->count();
            $progresTugas = $jumlahTugas > 0 ? (int) round($tugasSelesai / $jumlahTugas * 100) : 0;
        @endphp
            <div class="mb-20">
                <div class="d-flex justify-content-between mb-10">
                    <span class="fs-13 color-gray">{{ $project ? $project->kategori.' · '.\App\Livewire\Projects::STATUS[$project->status] : 'Ringkasan tugas project' }}</span>
                    <span class="fs-13 fw-500">{{ $tugasSelesai }}/{{ $jumlahTugas }} tugas</span>
                </div>
                <div class="progress" role="progressbar" aria-label="Progres tugas" aria-valuenow="{{ $progresTugas }}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar bg-primary" style="width: {{ $progresTugas }}%"></div>
                </div>
            </div>

            <form id="form-tambah-tugas" @class(['border', 'rounded', 'p-15', 'mb-20', 'd-none' => ! $project]) wire:submit="simpanTugas">
                <h6 class="mb-15">Tambah tugas</h6>
                <div class="row align-items-end">
                    <div class="col-12">
                        <x-masukan id="nama-tugas-project" label="Nama tugas" maxlength="180" wire:model="namaTugas" :kesalahan="$errors->first('namaTugas')" placeholder="Tuliskan tugas yang perlu diselesaikan" />
                    </div>
                    <div class="col-md-4">
                        <label for="status-tugas-project" class="il-gray fs-14 fw-500 mb-10">Status</label>
                        <select id="status-tugas-project" class="form-control form-control-default mb-25" wire:model="statusTugas">
                            @foreach (\App\Livewire\Projects::STATUS_TUGAS as $kode => $label)
                                <option value="{{ $kode }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-md-4">
                        <x-masukan id="tanggal-tugas-project" label="Target selesai" tipe="date" wire:model="tanggalTugas" :kesalahan="$errors->first('tanggalTugas')" />
                    </div>
                    <div class="col-md-4">
                        <label for="karyawan-tugas-project" class="il-gray fs-14 fw-500 mb-10">Penanggung jawab</label>
                        <select id="karyawan-tugas-project" class="form-control form-control-default mb-25" wire:model="karyawanTugasId">
                            <option value="">Belum ditentukan</option>
                            @foreach ($anggota as $anggotaProject)
                                <option value="{{ $anggotaProject->id }}">{{ $anggotaProject->nama }}</option>
                            @endforeach
                        </select>
                        @error('karyawanTugasId')<div class="invalid-feedback d-block mb-20">{{ $message }}</div>@enderror
                    </div>
                    <div class="col-12 d-flex justify-content-end">
                        <x-tombol tipe="submit" ukuran="sm" wire:loading.attr="disabled" wire:target="simpanTugas">Tambah tugas</x-tombol>
                    </div>
                </div>
            </form>

            <div class="d-flex justify-content-between align-items-center mb-10">
                <h6 class="mb-0">Daftar tugas</h6>
                <span class="fs-12 color-gray">{{ $jumlahTugas }} item</span>
            </div>
            @if ($tugas->isNotEmpty())
                <div class="table-responsive">
                    <table class="table table--default table-borderless mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th><span class="userDatatable-title">Tugas</span></th>
                                <th><span class="userDatatable-title">Penanggung jawab</span></th>
                                <th><span class="userDatatable-title">Target</span></th>
                                <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($tugas->sortBy('tanggal_selesai') as $task)
                                <tr wire:key="project-task-{{ $task->id }}">
                                    <td>
                                        <button type="button" class="btn-link border-0 bg-transparent p-0 text-start" wire:click="ubahStatusTugas({{ $task->id }})" aria-label="{{ $task->status === 'completed' ? 'Tandai belum selesai' : 'Tandai selesai' }}: {{ $task->nama }}">
                                            <i @class(['uil', 'uil-check-circle color-success' => $task->status === 'completed', 'uil-circle color-gray' => $task->status !== 'completed']) aria-hidden="true"></i>
                                            <span @class(['ms-5', 'text-decoration-line-through color-gray' => $task->status === 'completed'])>{{ $task->nama }}</span>
                                        </button>
                                    </td>
                                    <td>{{ $task->karyawan?->nama ?? '-' }}</td>
                                    <td>{{ $task->tanggal_selesai?->translatedFormat('j M Y') ?? '-' }}</td>
                                    <td class="text-end">
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'remove', 'label' => 'Hapus tugas '.$task->nama, 'click' => 'mintaHapusTugas('.$task->id.')', 'modal' => '#konfirmasi-hapus-tugas'],
                                        ]" />
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @else
                <p class="color-gray fs-13 mb-0">{{ $project ? 'Belum ada tugas untuk project ini.' : 'Pilih project untuk melihat tugas.' }}</p>
            @endif

        <div class="d-flex justify-content-end mt-20">
            <x-tombol warna="light" variasi="outlined" data-bs-dismiss="modal">Tutup</x-tombol>
        </div>
                </div>
            </div>
        </div>
    </div>

    <x-konfirmasi id="konfirmasi-hapus-project" judul="Hapus project?" aksi="hapusProject" tombol="Ya, hapus" warna="danger">
        Project ini beserta seluruh tugas dan anggota terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-tugas" judul="Hapus tugas?" aksi="konfirmasiHapusTugas" tombol="Ya, hapus" warna="danger">
        {{ $this->namaTugasHapus() ?: 'Tugas ini' }} akan dihapus dari project. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
