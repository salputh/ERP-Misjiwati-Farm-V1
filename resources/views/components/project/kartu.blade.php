@props(['project'])

{{-- Kartu project Basalt (card basalt-box). Garis kiri kartu mengikuti keadaan project (project-kartu--{late|completed|onHold|early}).
     Project selesai memakai bilah hijau dengan ikon centang, bukan persentase. --}}
<div {{ $attributes->class(['col-xl-4 mb-4 col-md-6']) }}>
    <section class="card basalt-box db-card project-kartu project-kartu--{{ $project->modifierKartu() }} h-100">
<div class="db-card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div class="d-flex flex-wrap align-items-center gap-2">
                    <a href="{{ route('project.show', $project) }}" class="text-body"><h2 class="h6 mb-0">{{ $project->nama }}</h2></a>
                    <span class="badge bg-{{ $project->warnaStatus() }}-subtle text-{{ $project->warnaStatus() }}">{{ $project->labelStatus() }}</span>
                </div>
                <div class="dropdown">
                    <button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Aksi project {{ $project->nama }}">
                        <i class="bi bi-three-dots" aria-hidden="true"></i>
                    </button>
                    <div class="dropdown-menu dropdown-menu-end">
                        <a class="dropdown-item" href="{{ route('project.show', $project) }}">Lihat</a>
                        <a class="dropdown-item" href="#" wire:click.prevent="ubah({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#modal-project">Ubah</a>
                        <a class="dropdown-item" href="#" wire:click.prevent="mintaHapusProject({{ $project->id }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-hapus-project">Hapus</a>
                    </div>
                </div>
            </div>

            <p class="text-body-secondary">{{ $project->deskripsi ?: 'Belum ada deskripsi project.' }}</p>

            <div class="d-flex flex-wrap gap-4 mb-3">
                <div>
                    <span class="d-block small text-body-secondary">Tanggal mulai</span>
                    <span class="fw-medium">{{ $project->tanggal_mulai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</span>
                </div>
                <div>
                    <span class="d-block small text-body-secondary">Target selesai</span>
                    <span @class(['fw-medium', 'text-danger' => $project->terlambat(), 'text-success' => ! $project->terlambat()])>{{ $project->tanggal_selesai?->translatedFormat('j M Y') ?? 'Belum ditentukan' }}</span>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2">
                <div class="progress flex-grow-1">
                    <div @class(['progress-bar', 'bg-success' => $project->status === 'completed', 'bg-primary' => $project->status !== 'completed', 'share-'.max(0, min(100, (int) round($project->progres())))]) role="progressbar" aria-valuenow="{{ $project->progres() }}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres {{ $project->nama }}"></div>
                </div>
                @if ($project->status === 'completed')
                    <i class="bi bi-check-circle-fill text-success" role="img" aria-label="Selesai"></i>
                @else
                    <span class="small">{{ $project->progres() }}%</span>
                @endif
            </div>
            <p class="text-body-secondary small mb-3">{{ $project->tugas_selesai_count }} / {{ $project->tugas_count }} tugas selesai</p>

            <p class="small text-body-secondary mb-2">Anggota project</p>
            @if ($project->anggota->isNotEmpty())
                <x-project.anggota :anggota="$project->anggota" />
            @else
                <p class="small text-body-secondary mb-0">Belum ada anggota</p>
            @endif
        
</div>
</section>
</div>
