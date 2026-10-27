<div>
    <div class="container-fluid">
        {{-- Kepala halaman Project Detail template: nama project, tambah tugas, tandai selesai, lalu ubah dan hapus di kanan --}}
        <div class="row">
            <div class="col-lg-12">
                <div class="breadcrumb-main application-ui mb-30">
                    <div class="breadcrumb-action d-flex">
                        <div class="d-flex align-items-center user-member__title me-sm-25 me-0">
                            <h4 class="text-capitalize fw-500 breadcrumb-title">{{ $this->project->nama }}</h4>
                        </div>
                        <div class="action-btn me-10 my-sm-0">
                            <a href="#" class="btn radius-md btn-primary bg-primary fs-12 fw-500" wire:click.prevent="tambahTugas" data-bs-toggle="modal" data-bs-target="#modal-tugas">
                                <img src="{{ asset('assets/img/svg/plus.svg') }}" alt="" class="svg"> Tambah tugas</a>
                        </div>
                        <div class="btn-group-toggle" wire:key="tandai-selesai-{{ $this->project->status }}">
                            <input type="checkbox" class="btn-check" id="tandai-selesai" @checked($this->project->status === 'completed') tabindex="-1">
                            <label class="btn btn-outline-secondary" for="tandai-selesai" role="button" tabindex="0" x-on:click.prevent data-bs-toggle="modal" data-bs-target="#konfirmasi-status-project">
                                <img src="{{ asset('assets/img/svg/check.svg') }}" alt="" class="svg">
                                {{ $this->project->status === 'completed' ? 'Sudah selesai' : 'Tandai selesai' }}</label>
                        </div>
                    </div>
                    <div class="d-flex text-capitalize">
                        <button type="button" class="breadcrumb-edit border-0 color-primary content-center bg-white fs-12 fw-500 radius-md" wire:click="ubahProject" data-bs-toggle="modal" data-bs-target="#modal-project">
                            <img src="{{ asset('assets/img/svg/edit-3.svg') }}" alt="" class="svg">Ubah</button>
                        <button type="button" class="breadcrumb-remove border-0 color-danger content-center bg-white fs-12 fw-500 ms-10 radius-md" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-project">
                            <img src="{{ asset('assets/img/svg/trash-2.svg') }}" alt="" class="svg">Hapus</button>
                    </div>
                </div>
            </div>

            @if ($pesan)
                <div class="col-12">
                    <x-peringatan warna="success" class="mb-25">{{ $pesan }}</x-peringatan>
                </div>
            @endif
        </div>

        <div class="projects-tab-content mb-30">
            <div class="row">
                {{-- Progres dan ringkasan tugas --}}
                <div class="col-xxl-3 col-lg-4 mb-25">
                    <div @class(['progress-box px-25 pt-25 pb-10 radius-xl', 'bg-success' => ! $this->project->terlambat(), 'bg-danger' => $this->project->terlambat()])>
                        <div class="d-flex justify-content-between mb-3">
                            <h6 class="text-white fw-500 fs-16 text-capitalize">Progres</h6>
                            <span class="progress-percentage text-white fw-500 fs-16 text-capitalize">{{ $this->project->progres() }}%</span>
                        </div>
                        <div class="progress-wrap d-flex align-items-center mb-15">
                            <div class="progress progress-height">
                                <div class="progress-bar bg-white" role="progressbar" style="width: {{ $this->project->progres() }}%;" aria-valuenow="{{ $this->project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres project"></div>
                            </div>
                        </div>
                    </div>
                    <div class="card mt-25">
                        <div class="card-body">
                            @foreach ($this->ringkasan as $angka)
                                <div @class(['application-task d-flex align-items-center', 'mb-25' => ! $loop->last])>
                                    <div class="application-task-icon wh-60 bg-opacity-{{ $angka['warna'] }} content-center">
                                        <img class="svg wh-25 text-{{ $angka['warna'] }}" src="{{ asset('assets/img/svg/'.$angka['ikon']) }}" alt="">
                                    </div>
                                    <div class="application-task-content">
                                        <h4>@angka($angka['nilai'])</h4>
                                        <span class="text-light fs-14 mt-1 text-capitalize">{{ $angka['label'] }}</span>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>

                {{-- Tentang project --}}
                <div class="col-xxl-6 col-lg-8 mb-25">
                    <div class="card border-0 pb-md-50 pb-15 h-100">
                        <div class="card-header py-sm-20 py-3 px-sm-25 px-3">
                            <h6>Tentang project</h6>
                        </div>
                        <div class="card-body">
                            <div class="about-projects">
                                <div class="about-projects__details">
                                    <p class="fs-15 mb-25">{{ $this->project->deskripsi ?: 'Belum ada deskripsi project.' }}</p>
                                </div>
                                <ul class="d-flex text-capitalize">
                                    <li>
                                        <span class="color-light fs-13">Kategori</span>
                                        <p class="color-dark fs-14 mt-1 mb-0 fw-500">{{ $this->project->kategori }}</p>
                                    </li>
                                    <li>
                                        <span class="color-light fs-13">Status</span>
                                        <p class="color-{{ $this->project->warnaStatus() }} fs-14 mt-1 mb-0 fw-500">{{ $this->project->labelStatus() }}</p>
                                    </li>
                                    <li>
                                        <span class="color-light fs-13">Tanggal mulai</span>
                                        <p class="color-primary fs-14 mt-1 mb-0 fw-500">{{ $this->project->tanggal_mulai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</p>
                                    </li>
                                    <li>
                                        <span class="color-light fs-13">Target selesai</span>
                                        <p class="color-danger fs-14 mt-1 mb-0 fw-500">{{ $this->project->tanggal_selesai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- Anggota project --}}
                <div class="col-xxl-3 col-12 mb-25">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center py-10 px-sm-25 px-3">
                            <h6 class="fw-500">Anggota</h6>
                            <button type="button" class="border radius-lg color-primary fw-500 fs-12 bg-transparent acButton" wire:click="ubahProject" data-bs-toggle="modal" data-bs-target="#modal-project">
                                <img src="{{ asset('assets/img/svg/user-plus.svg') }}" alt="" class="svg">
                                Atur anggota</button>
                        </div>
                        <div class="card-body">
                            @forelse ($this->project->anggota as $anggota)
                                <div @class(['d-flex align-items-center', 'mb-25' => ! $loop->last]) wire:key="anggota-{{ $anggota->id }}">
                                    <span class="wh-46 me-15 bg-opacity-primary color-primary fw-500 content-center" aria-hidden="true">{{ $anggota->inisial() }}</span>
                                    <div>
                                        <p class="fs-14 fw-400 color-dark mb-0">{{ $anggota->nama }}</p>
                                        <span class="mt-1 fs-14 color-light">{{ $anggota->jabatan->label() }}{{ $anggota->kandang ? ' · '.$anggota->kandang->nama : '' }}</span>
                                    </div>
                                </div>
                            @empty
                                <p class="fs-14 color-light mb-0">Belum ada anggota. Pilih Atur anggota untuk menambahkan karyawan.</p>
                            @endforelse
                        </div>
                    </div>
                </div>

                {{-- Daftar tugas dan aktivitas (tab ap-tab-main template) --}}
                <div class="col-12 mb-25">
                    <div class="card" x-data="{ tab: 'tugas' }">
                        <div class="card-header p-0">
                            <ul class="nav px-25 ap-tab-main app-ui-tab" role="tablist">
                                <li class="nav-item">
                                    <a href="#" class="nav-link active" role="tab" x-on:click.prevent="tab = 'tugas'" :class="{ 'active': tab === 'tugas' }" :aria-selected="tab === 'tugas'">Daftar tugas</a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link" role="tab" x-on:click.prevent="tab = 'aktivitas'" :class="{ 'active': tab === 'aktivitas' }" :aria-selected="tab === 'aktivitas'">Aktivitas</a>
                                </li>
                            </ul>
                        </div>
                        <div class="tab-content w-100">
                            <div class="tab-pane fade show active" role="tabpanel" :class="{ 'show active': tab === 'tugas' }">
                                <div class="card-body px-0 pt-15 pb-15">
                                    <div class="project-task table-responsive table-responsive--dynamic">
                                        @if ($this->project->tugas->isNotEmpty())
                                            <table class="table table-borderless">
                                                <tbody>
                                                    @foreach ($this->project->tugas as $tugas)
                                                        <tr class="project-task-list ptl--hover" wire:key="tugas-{{ $tugas->id }}">
                                                            <td>
                                                                <div class="checkbox-group d-flex">
                                                                    <div class="checkbox-theme-default custom-checkbox checkbox-group__single d-flex">
                                                                        <input class="checkbox" type="checkbox" id="tugas-{{ $tugas->id }}" @checked($tugas->status === 'completed') wire:click="ubahStatusTugas({{ $tugas->id }})">
                                                                        <label for="tugas-{{ $tugas->id }}" class="fs-14 color-light strikethrough">{{ $tugas->nama }}</label>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div class="project-task-list__right">
                                                                    <ul class="d-flex align-content-center">
                                                                        <li>
                                                                            <span @class(['fs-12 time-completed', 'text-light' => ! $tugas->terlambat(), 'color-danger' => $tugas->terlambat()])>
                                                                                {{ $tugas->karyawan?->nama ?? 'Belum ditugaskan' }} · {{ $tugas->tanggal_selesai?->translatedFormat('j M Y') ?? 'Tanpa target' }}
                                                                            </span>
                                                                        </li>
                                                                        <li>
                                                                            <a href="#" class="cross" wire:click.prevent="mintaHapusTugas({{ $tugas->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-tugas" aria-label="Hapus tugas {{ $tugas->nama }}">
                                                                                <i class="uil uil-times" aria-hidden="true"></i>
                                                                            </a>
                                                                        </li>
                                                                        <li>
                                                                            <div class="dropdown dropleft">
                                                                                <button type="button" class="btn-link border-0 bg-transparent p-0" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Aksi tugas {{ $tugas->nama }}">
                                                                                    <img src="{{ asset('assets/img/svg/more-horizontal.svg') }}" alt="" class="svg">
                                                                                </button>
                                                                                <div class="dropdown-menu dropdown-menu--dynamic">
                                                                                    <a class="dropdown-item" href="#" wire:click.prevent="ubahStatusTugas({{ $tugas->id }})">{{ $tugas->status === 'completed' ? 'Tandai belum selesai' : 'Tandai selesai' }}</a>
                                                                                    <a class="dropdown-item" href="#" wire:click.prevent="mintaHapusTugas({{ $tugas->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-tugas">Hapus</a>
                                                                                </div>
                                                                            </div>
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    @endforeach
                                                </tbody>
                                            </table>
                                        @else
                                            <p class="fs-14 color-light px-25 mb-0">Belum ada tugas untuk project ini.</p>
                                        @endif
                                        <div class="task-list-btn px-25 my-10">
                                            <button type="button" class="text-primary" wire:click="tambahTugas" data-bs-toggle="modal" data-bs-target="#modal-tugas">
                                                <img src="{{ asset('assets/img/svg/plus.svg') }}" alt="" class="svg">Tambah tugas baru</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="tab-pane fade" role="tabpanel" :class="{ 'show active': tab === 'aktivitas' }">
                                @forelse ($this->aktivitas as $tanggal => $sehari)
                                    <div @class(['card-body px-0 mx-25', 'border-bottom' => ! $loop->last]) wire:key="aktivitas-{{ $tanggal }}">
                                        <div class="task-activities d-flex align-items-center">
                                            <div class="task-activities__left d-flex">
                                                <div class="content-center border bg-normal radius-xl me-sm-20 me-0 task-activities__month">
                                                    <div class="px-20 text-center">
                                                        <h5>{{ $sehari->first()['waktu']->format('j') }}</h5>
                                                        <span class="fs-13 color-gray">{{ $sehari->first()['waktu']->translatedFormat('F') }}</span>
                                                    </div>
                                                </div>
                                                <div class="task-activities__right">
                                                    <ul>
                                                        @foreach ($sehari as $kejadian)
                                                            <li>
                                                                <div class="ffp d-flex justify-content-between align-items-center w-100">
                                                                    <div class="d-flex">
                                                                        <div class="me-3 ffp__imgWrapper d-flex align-items-center">
                                                                            <span @class(['wh-24 me-15 rounded-circle content-center', 'color-success bg-opacity-success' => $kejadian['selesai'], 'color-primary bg-opacity-primary' => ! $kejadian['selesai']])>
                                                                                <img src="{{ asset('assets/img/svg/'.($kejadian['selesai'] ? 'check.svg' : 'plus.svg')) }}" alt="" class="svg">
                                                                            </span>
                                                                        </div>
                                                                        <div>
                                                                            <p class="fw-500 fs-14 text-dark mb-0">
                                                                                {{ $kejadian['nama'] }}<span class="color-light mx-1 fw-400">{{ $kejadian['selesai'] ? 'diselesaikan' : 'ditambahkan' }}</span>{{ $kejadian['karyawan'] ? '· '.$kejadian['karyawan'] : '' }}
                                                                            </p>
                                                                            <span class="pt-1 d-block color-extra-light fs-12">{{ $kejadian['waktu']->format('H:i') }}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        @endforeach
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                @empty
                                    <div class="card-body">
                                        <p class="fs-14 color-light mb-0">Belum ada aktivitas tugas.</p>
                                    </div>
                                @endforelse
                            </div>
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
        <div class="form-group mb-25">
            <label class="il-gray fs-14 fw-500 align-center mb-10">Status</label>
            <x-pilih bentuk="isian" nama="Status tugas" :label="\App\Livewire\Projects::STATUS_TUGAS[$statusTugas] ?? 'Pilih status'" :kesalahan="$errors->has('statusTugas')">
                @foreach (\App\Livewire\Projects::STATUS_TUGAS as $kode => $label)
                    <button type="button" wire:click="$set('statusTugas', '{{ $kode }}')" @class(['dropdown-item', 'active' => $statusTugas === $kode])>{{ $label }}</button>
                @endforeach
            </x-pilih>
        </div>
        <div class="form-group mb-25">
            <label for="tanggal-tugas-project" class="il-gray fs-14 fw-500 align-center mb-10">Target selesai</label>
            <x-pilih-tanggal id="tanggal-tugas-project" ukuran="medium" :nilai="$tanggalTugas" :kesalahan="$errors->has('tanggalTugas')" x-on:tanggal-dipilih="$wire.set('tanggalTugas', $event.detail)" />
            @error('tanggalTugas')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
        </div>
        <div class="form-group mb-0">
            <label class="il-gray fs-14 fw-500 align-center mb-10">Penanggung jawab</label>
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
