@props(['project'])

{{-- Kartu project persis halaman Project template (user-group media-ui media-ui--{early|onHold|late|completed}).
     Project selesai memakai varian completed template: bilah hijau dengan ikon centang, bukan persentase. --}}
<div {{ $attributes->class(['col-xl-4 mb-25 col-md-6']) }}>
    <div class="user-group radius-xl bg-white media-ui media-ui--{{ $project->modifierKartu() }} pt-30 pb-25 h-100">
        <div class="border-bottom px-30">
            <div class="media user-group-media d-flex justify-content-between">
                <div @class(['media-body d-flex align-items-center text-capitalize', 'flex-wrap my-sm-0 my-n2' => $project->status !== 'completed'])>
                    <a href="{{ route('project.show', $project) }}">
                        <h6 @class(['mt-0 fw-500 media-ui__title', 'user-group' => $project->status !== 'completed'])>{{ $project->nama }}</h6>
                    </a>
                    <span @class(['media-badge text-uppercase color-white bg-'.$project->warnaStatus(), 'my-sm-0 my-2' => $project->status !== 'completed'])>{{ $project->labelStatus() }}</span>
                </div>
                <div class="mt-n15">
                    <div class="dropdown dropleft">
                        <button type="button" class="btn-link border-0 bg-transparent p-0" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Aksi project {{ $project->nama }}">
                            <img src="{{ asset('assets/img/svg/more-horizontal.svg') }}" alt="" class="svg">
                        </button>
                        <div @class(['dropdown-menu', 'dropdown-t-0' => $project->status !== 'completed'])>
                            <a class="dropdown-item" href="{{ route('project.show', $project) }}">Lihat</a>
                            <a class="dropdown-item" href="#" wire:click.prevent="ubah({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#modal-project">Ubah</a>
                            <a class="dropdown-item" href="#" wire:click.prevent="mintaHapusProject({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-project">Hapus</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="user-group-people mt-15 text-capitalize">
                <p>{{ $project->deskripsi ?: 'Belum ada deskripsi project.' }}</p>
                <div class="user-group-project">
                    <div class="d-flex align-items-center user-group-progress-top">
                        <div class="media-ui__start">
                            <span class="color-light fs-12">Tanggal mulai</span>
                            <p class="fs-14 fw-500 color-dark mb-0">{{ $project->tanggal_mulai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</p>
                        </div>
                        <div class="media-ui__end">
                            <span class="color-light fs-12">Target selesai</span>
                            <p @class(['fs-16 fw-500 mb-0', 'color-danger' => $project->terlambat(), 'color-success' => ! $project->terlambat()])>{{ $project->tanggal_selesai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="user-group-progress-bar">
                <div class="progress-wrap d-flex align-items-center mb-0">
                    <div class="progress">
                        <div @class(['progress-bar', 'bg-success' => $project->status === 'completed', 'bg-primary' => $project->status !== 'completed']) role="progressbar" style="width: {{ $project->progres() }}%;" aria-valuenow="{{ $project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres {{ $project->nama }}"></div>
                    </div>
                    @if ($project->status === 'completed')
                        <span class="progress-icon"><img src="{{ asset('assets/img/svg/check.svg') }}" alt="Selesai" class="svg color-success"></span>
                    @else
                        <span class="progress-percentage">{{ $project->progres() }}%</span>
                    @endif
                </div>
                <p class="color-light fs-12 mb-20">{{ $project->tugas_selesai_count }} / {{ $project->tugas_count }} tugas selesai</p>
            </div>
        </div>
        <div class="mt-20 px-30">
            <p class="fs-13 color-light mb-10">Anggota project</p>
            @if ($project->anggota->isNotEmpty())
                <x-project.anggota :anggota="$project->anggota" />
            @else
                <p class="fs-13 color-light mb-0">Belum ada anggota</p>
            @endif
        </div>
    </div>
</div>
