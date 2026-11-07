<div>
    <div class="container-fluid">
        {{-- Kepala halaman: judul, jumlah project berjalan, dan tombol buat project --}}
        <div class="row">
            <x-breadcrumb judul="Project" :jejak="['Project']">
                <span class="small text-body-secondary me-2">@angka($this->jumlahBerjalan) project berjalan</span>
                <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">Buat project</x-tombol.kepala>
            </x-breadcrumb>

            @if ($pesan)
                <div class="col-12">
                    <x-peringatan warna="success" class="mb-4">{{ $pesan }}</x-peringatan>
                </div>
            @endif
        </div>

        {{-- Tab status, pencarian, saringan kategori, dan pilihan tampilan grid atau list --}}
        <div class="row">
            <div class="col-lg-12">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div class="d-flex flex-wrap align-items-center gap-3">
                        <ul class="nav nav-pills nav-sm" role="tablist" aria-label="Saring status project">
                            @foreach (['all' => 'Semua project', 'in_progress' => 'Berjalan', 'planned' => 'Direncanakan', 'completed' => 'Selesai', 'overdue' => 'Terlambat'] as $kode => $label)
                                <li class="nav-item">
                                    <a href="#" role="tab" @class(['nav-link', 'active' => $filterStatus === $kode]) aria-selected="{{ $filterStatus === $kode ? 'true' : 'false' }}" wire:click.prevent="$set('filterStatus', '{{ $kode }}')">{{ $label }}</a>
                                </li>
                            @endforeach
                        </ul>
                        <form x-on:submit.prevent role="search">
                            <label for="cari-project" class="visually-hidden">Cari project</label>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                                <input id="cari-project" class="form-control" type="search" placeholder="Cari nama project" wire:model.live.debounce.300ms="cari">
                            </div>
                        </form>
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-3">
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-body-secondary small">Kategori:</span>
                            <x-pilih bentuk="isian" nama="Saring kategori project" :label="$filterKategori === 'all' ? 'Semua kategori' : $filterKategori">
                                <button type="button" wire:click="$set('filterKategori', 'all')" @class(['dropdown-item', 'active' => $filterKategori === 'all'])>Semua kategori</button>
                                @foreach ($this->kategoriProyek as $kategoriProject)
                                    <button type="button" wire:click="$set('filterKategori', @js($kategoriProject))" @class(['dropdown-item', 'active' => $filterKategori === $kategoriProject])>{{ $kategoriProject }}</button>
                                @endforeach
                            </x-pilih>
                        </div>
                        <div class="btn-group btn-group-sm" role="group" aria-label="Pilih tampilan">
                            <button type="button" @class(['btn btn-outline-secondary', 'active' => $tampilan === 'grid']) wire:click="pilihTampilan('grid')" aria-label="Tampilan grid" aria-pressed="{{ $tampilan === 'grid' ? 'true' : 'false' }}"><i class="bi bi-grid" aria-hidden="true"></i></button>
                            <button type="button" @class(['btn btn-outline-secondary', 'active' => $tampilan === 'list']) wire:click="pilihTampilan('list')" aria-label="Tampilan list" aria-pressed="{{ $tampilan === 'list' ? 'true' : 'false' }}"><i class="bi bi-list-ul" aria-hidden="true"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="projects-tab-content">
            <div class="row mt-4">
                @if ($this->projects->isEmpty())
                    @if ($cari || $filterStatus !== 'all' || $filterKategori !== 'all')
                        <x-kosong judul="Project tidak ditemukan">Ubah pencarian atau saringan untuk melihat project lainnya.</x-kosong>
                    @else
                        <x-kosong judul="Belum ada project">
                            Buat project pertama untuk mulai mengelola pekerjaan dan tugas.
                            <x-slot:aksi>
                                <x-tombol ikon="bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-project">Buat project</x-tombol>
                            </x-slot:aksi>
                        </x-kosong>
                    @endif
                @elseif ($tampilan === 'list')
                    {{-- Tampilan list: tabel tabel Basalt --}}
                    <div class="col-12 mb-4">
                        <section class="card basalt-box db-card">
<div class="db-card-body db-card-body-table">
                                <div class="tabel-data">
                                    <div class="table-responsive">
                                        <table class="table mb-0 db-table">
                                            <thead>
                                                <tr>
                                                    <th>Project</th>
                                                    <th>Status</th>
                                                    <th>Tanggal mulai</th>
                                                    <th>Target selesai</th>
                                                    <th>Progres</th>
                                                    <th>Anggota</th>
                                                    <th class="text-end">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                @foreach ($this->projects as $project)
                                                    <tr wire:key="baris-project-{{ $project->id }}">
                                                        <td>
                                                            <a href="{{ route('project.show', $project) }}" class="d-block text-body fw-medium">{{ $project->nama }}</a>
                                                            <span class="d-block small text-body-secondary">{{ $project->kategori }}</span>
                                                        </td>
                                                        <td><span class="badge m-0 bg-{{ $project->warnaStatus() }}-subtle text-{{ $project->warnaStatus() }}">{{ $project->labelStatus() }}</span></td>
                                                        <td>{{ $project->tanggal_mulai?->translatedFormat('j M Y') ?? '-' }}</td>
                                                        <td><div @class(['', 'text-danger' => $project->terlambat()])>{{ $project->tanggal_selesai?->translatedFormat('j M Y') ?? '-' }}</div></td>
                                                        <td class="w-25">
                                                            <div class="d-flex align-items-center mb-0">
                                                                <div class="progress">
                                                                    <div @class(['progress-bar', 'bg-success' => $project->status === 'completed', 'bg-primary' => $project->status !== 'completed', 'share-'.max(0, min(100, (int) round($project->progres())))]) role="progressbar" aria-valuenow="{{ $project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres {{ $project->nama }}"></div>
                                                                </div>
                                                                <span class="small ms-2">{{ $project->progres() }}%</span>
                                                            </div>
                                                            <span class="d-block small text-body-secondary">{{ $project->tugas_selesai_count }} / {{ $project->tugas_count }} tugas selesai</span>
                                                        </td>
                                                        <td>
                                                            @if ($project->anggota->isNotEmpty())
                                                                <x-project.anggota :anggota="$project->anggota" batas="4" />
                                                            @else
                                                                <span class="small text-body-secondary">-</span>
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
</section>
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
                        <div class="d-flex justify-content-sm-end justify-content-start mt-1 mb-4">
                            <nav class="dm-page" aria-label="Halaman project">
                                <ul class="d-flex">
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
