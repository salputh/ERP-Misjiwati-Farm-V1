<div>
    <div class="container-fluid">
        {{-- Kepala halaman Project template: judul, jumlah project berjalan, dan tombol buat project --}}
        <div class="row">
            <div class="col-lg-12">
                <div class="project-progree-breadcrumb">
                    <div class="breadcrumb-main user-member justify-content-sm-between">
                        <div class="d-flex flex-wrap justify-content-center breadcrumb-main__wrapper">
                            <div class="d-flex align-items-center user-member__title justify-content-center me-sm-25">
                                <h4 class="text-capitalize fw-500 breadcrumb-title">Project</h4>
                                <span class="sub-title ms-sm-25 ps-sm-25">@angka($this->jumlahBerjalan) project berjalan</span>
                            </div>
                        </div>
                        <x-tombol.kepala ikon="las la-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">Buat project</x-tombol.kepala>
                    </div>
                </div>
            </div>

            @if ($pesan)
                <div class="col-12">
                    <x-peringatan warna="success" class="mb-25">{{ $pesan }}</x-peringatan>
                </div>
            @endif
        </div>

        {{-- Tab status, pencarian, saringan kategori, dan pilihan tampilan grid atau list (HexaDash: project-top-wrapper) --}}
        <div class="row">
            <div class="col-lg-12">
                <div class="project-top-wrapper project-top-progress d-flex justify-content-between flex-wrap">
                    <div class="project-top-left d-flex flex-wrap justify-content-lg-between justify-content-center mt-n10">
                        <div class="project-tap global-shadow order-lg-1 order-2 my-10">
                            <ul class="nav px-1" role="tablist" aria-label="Saring status project">
                                @foreach (['all' => 'Semua project', 'in_progress' => 'Berjalan', 'planned' => 'Direncanakan', 'completed' => 'Selesai', 'overdue' => 'Terlambat'] as $kode => $label)
                                    <li class="nav-item">
                                        <a href="#" role="tab" @class(['nav-link', 'active' => $filterStatus === $kode]) aria-selected="{{ $filterStatus === $kode ? 'true' : 'false' }}" wire:click.prevent="$set('filterStatus', '{{ $kode }}')">{{ $label }}</a>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                        <div class="project-search project-search--height global-shadow ms-md-20 my-10 order-md-2 order-1">
                            <form class="d-flex align-items-center user-member__form" x-on:submit.prevent>
                                <img src="{{ asset('assets/img/svg/search.svg') }}" alt="" class="svg">
                                <input id="cari-project" class="form-control me-sm-2 border-0 box-shadow-none" type="search" placeholder="Cari nama project" aria-label="Cari project" wire:model.live.debounce.300ms="cari">
                            </form>
                        </div>
                    </div>
                    <div class="project-top-right d-flex flex-wrap">
                        <div class="project-category">
                            <div class="d-flex align-items-center">
                                <p class="mb-0 me-10 fs-14 color-light">Kategori:</p>
                                <div class="project-category__select">
                                    <x-pilih bentuk="isian" nama="Saring kategori project" :label="$filterKategori === 'all' ? 'Semua kategori' : $filterKategori">
                                        <button type="button" wire:click="$set('filterKategori', 'all')" @class(['dropdown-item', 'active' => $filterKategori === 'all'])>Semua kategori</button>
                                        @foreach ($this->kategoriProyek as $kategoriProject)
                                            <button type="button" wire:click="$set('filterKategori', @js($kategoriProject))" @class(['dropdown-item', 'active' => $filterKategori === $kategoriProject])>{{ $kategoriProject }}</button>
                                        @endforeach
                                    </x-pilih>
                                </div>
                            </div>
                        </div>
                        <div class="project-icon-selected">
                            <div class="icon-list-social d-flex" role="group" aria-label="Pilih tampilan">
                                <a href="#" @class(['icon-list-social__link rounded-circle icon-list-social__style justify-content-center ms-xl-20 me-20', 'active' => $tampilan === 'grid']) wire:click.prevent="pilihTampilan('grid')" aria-label="Tampilan grid" aria-pressed="{{ $tampilan === 'grid' ? 'true' : 'false' }}">
                                    <img class="svg" src="{{ asset('assets/img/svg/grid.svg') }}" alt=""></a>
                                <a href="#" @class(['icon-list-social__link rounded-circle icon-list-social__style justify-content-center', 'active' => $tampilan === 'list']) wire:click.prevent="pilihTampilan('list')" aria-label="Tampilan list" aria-pressed="{{ $tampilan === 'list' ? 'true' : 'false' }}">
                                    <img class="svg" src="{{ asset('assets/img/svg/list.svg') }}" alt=""></a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="projects-tab-content projects-tab-content--progress">
            <div class="row mt-25">
                @if ($this->projects->isEmpty())
                    @if ($cari || $filterStatus !== 'all' || $filterKategori !== 'all')
                        <x-kosong judul="Project tidak ditemukan">Ubah pencarian atau saringan untuk melihat project lainnya.</x-kosong>
                    @else
                        <x-kosong judul="Belum ada project">
                            Buat project pertama untuk mulai mengelola pekerjaan dan tugas.
                            <x-slot:aksi>
                                <x-tombol ikon="uil-plus" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">Buat project</x-tombol>
                            </x-slot:aksi>
                        </x-kosong>
                    @endif
                @elseif ($tampilan === 'list')
                    {{-- Tampilan list: tabel Basic Usage template (table4 + userDatatable) --}}
                    <div class="col-12 mb-25">
                        <div class="card card-default card-md">
                            <div class="card-body p-0">
                                <div class="table4 p-25">
                                    <div class="table-responsive">
                                        <table class="table mb-0">
                                            <thead>
                                                <tr class="userDatatable-header">
                                                    <th><span class="userDatatable-title">Project</span></th>
                                                    <th><span class="userDatatable-title">Status</span></th>
                                                    <th><span class="userDatatable-title">Tanggal mulai</span></th>
                                                    <th><span class="userDatatable-title">Target selesai</span></th>
                                                    <th><span class="userDatatable-title">Progres</span></th>
                                                    <th><span class="userDatatable-title">Anggota</span></th>
                                                    <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                @foreach ($this->projects as $project)
                                                    <tr wire:key="baris-project-{{ $project->id }}">
                                                        <td>
                                                            <a href="{{ route('project.show', $project) }}" class="d-block color-dark fw-500">{{ $project->nama }}</a>
                                                            <span class="d-block fs-13 color-light">{{ $project->kategori }}</span>
                                                        </td>
                                                        <td><span class="dm-tag tag-transparented m-0 tag-{{ $project->warnaStatus() }}">{{ $project->labelStatus() }}</span></td>
                                                        <td><div class="userDatatable-content">{{ $project->tanggal_mulai?->translatedFormat('j M Y') ?? '-' }}</div></td>
                                                        <td><div @class(['userDatatable-content', 'color-danger' => $project->terlambat()])>{{ $project->tanggal_selesai?->translatedFormat('j M Y') ?? '-' }}</div></td>
                                                        <td class="w-25">
                                                            <div class="progress-wrap d-flex align-items-center mb-0">
                                                                <div class="progress">
                                                                    <div @class(['progress-bar', 'bg-success' => $project->status === 'completed', 'bg-primary' => $project->status !== 'completed']) role="progressbar" style="width: {{ $project->progres() }}%;" aria-valuenow="{{ $project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres {{ $project->nama }}"></div>
                                                                </div>
                                                                <span class="progress-percentage">{{ $project->progres() }}%</span>
                                                            </div>
                                                            <span class="d-block fs-12 color-light">{{ $project->tugas_selesai_count }} / {{ $project->tugas_count }} tugas selesai</span>
                                                        </td>
                                                        <td>
                                                            @if ($project->anggota->isNotEmpty())
                                                                <x-project.anggota :anggota="$project->anggota" batas="4" />
                                                            @else
                                                                <span class="fs-13 color-light">-</span>
                                                            @endif
                                                        </td>
                                                        <td>
                                                            <x-aksi.ikon :aksi="[
                                                                ['kelas' => 'view', 'label' => 'Lihat project '.$project->nama, 'href' => route('project.show', $project)],
                                                                ['kelas' => 'edit', 'label' => 'Ubah project '.$project->nama, 'click' => 'ubah('.$project->id.')', 'modal' => '#modal-project'],
                                                                ['kelas' => 'remove', 'label' => 'Hapus project '.$project->nama, 'click' => 'mintaHapusProject('.$project->id.')', 'modal' => '#konfirmasi-hapus-project'],
                                                            ]" />
                                                        </td>
                                                    </tr>
                                                @endforeach
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                @else
                    {{-- Tampilan grid: kartu project template (user-group media-ui) --}}
                    @foreach ($this->projects as $project)
                        <x-project.kartu :project="$project" wire:key="project-{{ $project->id }}" />
                    @endforeach
                @endif
            </div>

            @if ($this->projects->total() > \App\Livewire\Projects::PER_HALAMAN[0])
                {{-- Pagination template: tautan halaman dan pilihan jumlah per halaman --}}
                <div class="row">
                    <div class="col-lg-12">
                        <div class="d-flex justify-content-sm-end justify-content-start mt-1 mb-30">
                            <nav class="dm-page" aria-label="Halaman project">
                                <ul class="dm-pagination d-flex">
                                    <li class="dm-pagination__item">
                                        {{ $this->projects->links() }}
                                    </li>
                                    <li class="dm-pagination__item">
                                        <div class="paging-option">
                                            <x-pilih bentuk="isian" nama="Jumlah project per halaman" :label="$perHalaman.'/halaman'">
                                                @foreach (\App\Livewire\Projects::PER_HALAMAN as $jumlah)
                                                    <button type="button" wire:click="pilihPerHalaman({{ $jumlah }})" @class(['dropdown-item', 'active' => $perHalaman === $jumlah])>{{ $jumlah }}/halaman</button>
                                                @endforeach
                                            </x-pilih>
                                        </div>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
            @endif
        </div>
    </div>

    <x-memuat target="simpan, hapusProject" teks="Memperbarui project" />
    <x-memuat target="cari, filterStatus, filterKategori, pilihTampilan, pilihPerHalaman, gotoPage, nextPage, previousPage" teks="Memuat project" cepat />

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

    <x-konfirmasi id="konfirmasi-hapus-project" judul="Hapus project?" aksi="hapusProject" tombol="Ya, hapus" warna="danger" memuat="mintaHapusProject">
        {{ $this->namaProjectHapus() ?: 'Project ini' }} beserta seluruh tugas dan anggotanya akan dihapus. Tindakan ini tidak dapat dibatalkan.
    </x-konfirmasi>
</div>
