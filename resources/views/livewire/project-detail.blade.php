<div>
    <div class="container-fluid">
        {{-- Kepala halaman: nama project, tambah tugas, tandai selesai, lalu ubah dan hapus --}}
        <div class="row">
            <x-breadcrumb :judul="$this->project->nama" :jejak="['Project', $this->project->nama]">
                <button type="button" class="btn btn-primary btn-sm" wire:click="tambahTugas" data-bs-toggle="modal" data-bs-target="#modal-tugas">
                    <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tambah tugas
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-toggle="modal" data-bs-target="#konfirmasi-status-project">
                    <i class="bi bi-check2 me-1" aria-hidden="true"></i>{{ $this->project->status === 'completed' ? 'Sudah selesai' : 'Tandai selesai' }}
                </button>
                <button type="button" class="btn btn-outline-primary btn-sm" wire:click="ubahProject" data-bs-toggle="modal" data-bs-target="#modal-project">
                    <i class="bi bi-pencil-square me-1" aria-hidden="true"></i>Ubah
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-project">
                    <i class="bi bi-trash me-1" aria-hidden="true"></i>Hapus
                </button>
            </x-breadcrumb>

            @if ($pesan)
                <div class="col-12">
                    <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
                </div>
            @endif
        </div>

        <div class="row">
            {{-- Progres dan ringkasan tugas --}}
            <div class="col-xxl-3 col-lg-4 mb-4">
                <div @class(['card basalt-box mb-4 text-white', 'bg-success' => ! $this->project->terlambat(), 'bg-danger' => $this->project->terlambat()])>
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-3">
                            <h2 class="h6 mb-0">Progres</h2>
                            <span class="fw-medium">{{ $this->project->progres() }}%</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar bg-white share-{{ max(0, min(100, (int) round($this->project->progres()))) }}" role="progressbar" aria-valuenow="{{ $this->project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres project"></div>
                        </div>
                    </div>
                </div>
                <section class="card basalt-box db-card">
<div class="db-card-body">
                        @foreach ($this->ringkasan as $angka)
                            <div @class(['d-flex align-items-center gap-3', 'mb-4' => ! $loop->last])>
                                <span class="lingkar-46 rounded-3 bg-{{ $angka['warna'] }}-subtle text-{{ $angka['warna'] }} d-flex align-items-center justify-content-center" aria-hidden="true"><i class="bi {{ $angka['ikon'] }} fs-5"></i></span>
                                <div>
                                    <p class="h5 mb-0">@angka($angka['nilai'])</p>
                                    <span class="small text-body-secondary">{{ $angka['label'] }}</span>
                                </div>
                            </div>
                        @endforeach
                    
</div>
</section>
            </div>

            {{-- Tentang project --}}
            <div class="col-xxl-6 col-lg-8 mb-4">
                <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Tentang project</h2></div>
</header>
                        <p class="mb-4">{{ $this->project->deskripsi ?: 'Belum ada deskripsi project.' }}</p>
                        <dl class="row mb-0">
                            <div class="col-6 col-md-3 mb-3 mb-md-0">
                                <dt class="small fw-normal text-body-secondary">Kategori</dt>
                                <dd class="fw-medium mb-0">{{ $this->project->kategori }}</dd>
                            </div>
                            <div class="col-6 col-md-3 mb-3 mb-md-0">
                                <dt class="small fw-normal text-body-secondary">Status</dt>
                                <dd class="fw-medium mb-0 text-{{ $this->project->warnaStatus() }}">{{ $this->project->labelStatus() }}</dd>
                            </div>
                            <div class="col-6 col-md-3">
                                <dt class="small fw-normal text-body-secondary">Tanggal mulai</dt>
                                <dd class="fw-medium mb-0 text-primary">{{ $this->project->tanggal_mulai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</dd>
                            </div>
                            <div class="col-6 col-md-3">
                                <dt class="small fw-normal text-body-secondary">Target selesai</dt>
                                <dd class="fw-medium mb-0 text-danger">{{ $this->project->tanggal_selesai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</dd>
                            </div>
                        </dl>
                    
</div>
</section>
            </div>

            {{-- Anggota project --}}
            <div class="col-xxl-3 col-12 mb-4">
                <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Anggota</h2></div>
                        <button type="button" class="btn btn-outline-primary btn-sm" wire:click="ubahProject" data-bs-toggle="modal" data-bs-target="#modal-project">
                            <i class="bi bi-person-plus me-1" aria-hidden="true"></i>Atur anggota
                        </button>
</header>
                        @forelse ($this->project->anggota as $anggota)
                            <div @class(['d-flex align-items-center', 'mb-3' => ! $loop->last]) wire:key="anggota-{{ $anggota->id }}">
                                <span class="lingkar-46 rounded-circle me-3 bg-primary-subtle text-primary fw-medium d-flex align-items-center justify-content-center" aria-hidden="true">{{ $anggota->inisial() }}</span>
                                <div>
                                    <p class="mb-0">{{ $anggota->nama }}</p>
                                    <span class="small text-body-secondary">{{ $anggota->jabatan->label() }}{{ $anggota->kandang ? ' · '.$anggota->kandang->nama : '' }}</span>
                                </div>
                            </div>
                        @empty
                            <p class="text-body-secondary mb-0">Belum ada anggota. Pilih Atur anggota untuk menambahkan karyawan.</p>
                        @endforelse
                    
</div>
</section>
            </div>

            {{-- Daftar tugas dan aktivitas --}}
            <div class="col-12 mb-4">
                <div class="card basalt-box" x-data="{ tab: 'tugas' }">
                    <div class="card-header">
                        <ul class="nav nav-pills nav-sm" role="tablist">
                            <li class="nav-item">
                                <a href="#" class="nav-link active" role="tab" x-on:click.prevent="tab = 'tugas'" :class="{ 'active': tab === 'tugas' }" :aria-selected="tab === 'tugas'">Daftar tugas</a>
                            </li>
                            <li class="nav-item">
                                <a href="#" class="nav-link" role="tab" x-on:click.prevent="tab = 'aktivitas'" :class="{ 'active': tab === 'aktivitas' }" :aria-selected="tab === 'aktivitas'">Aktivitas</a>
                            </li>
                        </ul>
                    </div>
                    <div class="tab-content">
                        <div class="tab-pane fade show active" role="tabpanel" :class="{ 'show active': tab === 'tugas' }">
                            @if ($this->project->tugas->isNotEmpty())
                                <ul class="list-group list-group-flush">
                                    @foreach ($this->project->tugas as $tugas)
                                        <li class="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2" wire:key="tugas-{{ $tugas->id }}">
                                            <div class="form-check mb-0">
                                                <input class="form-check-input" type="checkbox" id="tugas-{{ $tugas->id }}" @checked($tugas->status === 'completed') wire:click="ubahStatusTugas({{ $tugas->id }})">
                                                <label for="tugas-{{ $tugas->id }}" @class(['form-check-label', 'text-body-secondary text-decoration-line-through' => $tugas->status === 'completed'])>{{ $tugas->nama }}</label>
                                            </div>
                                            <div class="d-flex align-items-center gap-2">
                                                <span @class(['small', 'text-body-secondary' => ! $tugas->terlambat(), 'text-danger' => $tugas->terlambat()])>
                                                    {{ $tugas->karyawan?->nama ?? 'Belum ditugaskan' }} · {{ $tugas->tanggal_selesai?->translatedFormat('j M Y') ?? 'Tanpa target' }}
                                                </span>
                                                <a href="#" class="btn btn-icon btn-sm text-danger" wire:click.prevent="mintaHapusTugas({{ $tugas->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-tugas" aria-label="Hapus tugas {{ $tugas->nama }}">
                                                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                                                </a>
                                                <div class="dropdown">
                                                    <button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Aksi tugas {{ $tugas->nama }}">
                                                        <i class="bi bi-three-dots" aria-hidden="true"></i>
                                                    </button>
                                                    <div class="dropdown-menu dropdown-menu-end">
                                                        <a class="dropdown-item" href="#" wire:click.prevent="ubahStatusTugas({{ $tugas->id }})">{{ $tugas->status === 'completed' ? 'Tandai belum selesai' : 'Tandai selesai' }}</a>
                                                        <a class="dropdown-item" href="#" wire:click.prevent="mintaHapusTugas({{ $tugas->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-tugas">Hapus</a>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    @endforeach
                                </ul>
                            @else
                                <p class="text-body-secondary m-3">Belum ada tugas untuk project ini.</p>
                            @endif
                            <div class="card-body">
                                <button type="button" class="btn btn-link text-primary p-0" wire:click="tambahTugas" data-bs-toggle="modal" data-bs-target="#modal-tugas">
                                    <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tambah tugas baru
                                </button>
                            </div>
                        </div>
                        <div class="tab-pane fade" role="tabpanel" :class="{ 'show active': tab === 'aktivitas' }">
                            @forelse ($this->aktivitas as $tanggal => $sehari)
                                <div @class(['card-body d-flex gap-3', 'border-bottom' => ! $loop->last]) wire:key="aktivitas-{{ $tanggal }}">
                                    <div class="border bg-body-secondary rounded-3 px-3 py-2 text-center align-self-start">
                                        <p class="h5 mb-0">{{ $sehari->first()['waktu']->format('j') }}</p>
                                        <span class="small text-body-secondary">{{ $sehari->first()['waktu']->translatedFormat('F') }}</span>
                                    </div>
                                    <ul class="list-unstyled mb-0 flex-grow-1">
                                        @foreach ($sehari as $kejadian)
                                            <li @class(['d-flex align-items-start gap-3', 'mb-3' => ! $loop->last])>
                                                <span @class(['lingkar-25 rounded-circle d-flex align-items-center justify-content-center', 'text-success bg-success-subtle' => $kejadian['selesai'], 'text-primary bg-primary-subtle' => ! $kejadian['selesai']]) aria-hidden="true">
                                                    <i class="bi {{ $kejadian['selesai'] ? 'bi-check-lg' : 'bi-plus-lg' }}"></i>
                                                </span>
                                                <div>
                                                    <p class="fw-medium mb-0">
                                                        {{ $kejadian['nama'] }}<span class="text-body-secondary mx-1 fw-normal">{{ $kejadian['selesai'] ? 'diselesaikan' : 'ditambahkan' }}</span>{{ $kejadian['karyawan'] ? '· '.$kejadian['karyawan'] : '' }}
                                                    </p>
                                                    <span class="d-block text-body-secondary small">{{ $kejadian['waktu']->format('H:i') }}</span>
                                                </div>
                                            </li>
                                        @endforeach
                                    </ul>
                                </div>
                            @empty
                                <div class="card-body">
                                    <p class="text-body-secondary mb-0">Belum ada aktivitas tugas.</p>
                                </div>
                            @endforelse
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <x-memuat target="simpan, simpanTugas, ubahStatusTugas, ubahStatusProject, hapusTugas, hapusProject" teks="Memperbarui project" />

    <x-project.form
        :ubah="(bool) $projectId"
        :status="$status"
        :tanggal-mulai="$tanggalMulai"
        :tanggal-selesai="$tanggalSelesai"
        :anggota-terpilih="$anggotaTerpilih"
        :karyawan="$this->karyawan"
        :kelompok="$this->kelompokKaryawan"
        :kategori="$this->kategoriProyek"
    />

    <x-modal id="modal-tugas" judul="Tambah tugas" submit="simpanTugas" x-on:tutup-modal-tugas.window="bootstrap.Modal.getInstance($el)?.hide()">
        <x-masukan id="nama-tugas-project" label="Nama tugas" maxlength="180" wire:model="namaTugas" :kesalahan="$errors->first('namaTugas')" placeholder="Tuliskan tugas yang perlu diselesaikan" autocomplete="off" />
        <div class="mb-3 mb-4">
            <label class="form-label fw-medium mb-2">Status</label>
            <x-pilih bentuk="isian" nama="Status tugas" :label="\App\Livewire\Projects::STATUS_TUGAS[$statusTugas] ?? 'Pilih status'" :kesalahan="$errors->has('statusTugas')">
                @foreach (\App\Livewire\Projects::STATUS_TUGAS as $kode => $label)
                    <button type="button" wire:click="$set('statusTugas', '{{ $kode }}')" @class(['dropdown-item', 'active' => $statusTugas === $kode])>{{ $label }}</button>
                @endforeach
            </x-pilih>
        </div>
        <div class="mb-3 mb-4">
            <label for="tanggal-tugas-project" class="form-label fw-medium mb-2">Target selesai</label>
            <x-pilih-tanggal id="tanggal-tugas-project" ukuran="medium" :nilai="$tanggalTugas" :kesalahan="$errors->has('tanggalTugas')" x-on:tanggal-dipilih="$wire.set('tanggalTugas', $event.detail)" />
            @error('tanggalTugas')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
        </div>
        <div class="mb-3 mb-0">
            <label class="form-label fw-medium mb-2">Penanggung jawab</label>
            <x-pilih bentuk="isian" nama="Penanggung jawab" :label="$this->project->anggota->firstWhere('id', (int) $karyawanTugasId)?->nama ?? 'Belum ditentukan'" :kesalahan="$errors->has('karyawanTugasId')">
                <button type="button" wire:click="$set('karyawanTugasId', null)" @class(['dropdown-item', 'active' => ! $karyawanTugasId])>Belum ditentukan</button>
                @foreach ($this->project->anggota as $anggotaProject)
                    <button type="button" wire:click="$set('karyawanTugasId', {{ $anggotaProject->id }})" @class(['dropdown-item', 'active' => (int) $karyawanTugasId === $anggotaProject->id])>{{ $anggotaProject->nama }}</button>
                @endforeach
            </x-pilih>
            @error('karyawanTugasId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
        </div>

        <x-slot:footer>
            <x-tombol.batal />
            <x-tombol tipe="submit" wire:loading.attr="disabled" wire:target="simpanTugas">Tambah tugas</x-tombol>
        </x-slot:footer>
    </x-modal>

    <x-konfirmasi id="konfirmasi-status-project" :judul="$this->project->status === 'completed' ? 'Buka kembali project?' : 'Tandai project selesai?'" aksi="ubahStatusProject" tombol="Ya, ubah status">
        {{ $this->project->status === 'completed' ? 'Status project akan kembali menjadi berjalan.' : 'Status project akan diubah menjadi selesai.' }}
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-tugas" judul="Hapus tugas?" aksi="hapusTugas" tombol="Ya, hapus" warna="danger" memuat="mintaHapusTugas">
        {{ $this->namaTugasHapus() ?: 'Tugas ini' }} akan dihapus dari project. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>

    <x-konfirmasi id="konfirmasi-hapus-project" judul="Hapus project?" aksi="hapusProject" tombol="Ya, hapus" warna="danger">
        {{ $this->project->nama }} beserta seluruh tugas dan anggotanya akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
