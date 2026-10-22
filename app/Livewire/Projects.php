<?php

namespace App\Livewire;

use App\Models\Karyawan;
use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Project')]
class Projects extends Component
{
    public const STATUS = [
        'planned' => 'Direncanakan',
        'in_progress' => 'Berjalan',
        'on_hold' => 'Ditunda',
        'completed' => 'Selesai',
    ];

    public const STATUS_TUGAS = [
        'pending' => 'Belum dikerjakan',
        'in_progress' => 'Dikerjakan',
        'completed' => 'Selesai',
    ];

    public string $cari = '';

    public string $filterStatus = 'all';

    public string $filterKategori = 'all';

    public ?int $projectId = null;

    public string $nama = '';

    public string $kategori = '';

    public string $deskripsi = '';

    public string $status = 'planned';

    public string $tanggalMulai = '';

    public string $tanggalSelesai = '';

    /** @var list<int|string> */
    public array $anggotaTerpilih = [];

    public ?int $projectTugasId = null;

    public string $namaTugas = '';

    public string $statusTugas = 'pending';

    public ?string $tanggalTugas = null;

    public ?int $karyawanTugasId = null;

    public ?int $hapusProjectId = null;

    public string $pesan = '';

    #[Computed]
    public function projects(): Collection
    {
        return Project::query()
            ->with('anggota')
            ->withCount('tugas')
            ->withCount(['tugas as tugas_selesai_count' => fn ($query) => $query->where('status', 'completed')])
            ->when($this->cari !== '', fn ($query) => $query->where('nama', 'like', '%'.trim($this->cari).'%'))
            ->when($this->filterKategori !== 'all', fn ($query) => $query->where('kategori', $this->filterKategori))
            ->when($this->filterStatus === 'overdue', function ($query): void {
                $query->whereNotIn('status', ['completed', 'on_hold'])
                    ->whereDate('tanggal_selesai', '<', today());
            })
            ->when(in_array($this->filterStatus, ['planned', 'in_progress', 'on_hold', 'completed'], true), fn ($query) => $query->where('status', $this->filterStatus))
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END")
            ->orderBy('tanggal_selesai')
            ->get();
    }

    #[Computed]
    public function karyawan(): Collection
    {
        return Karyawan::query()->orderBy('nama')->get();
    }

    #[Computed]
    public function kategoriProyek(): SupportCollection
    {
        return Project::query()->select('kategori')->distinct()->orderBy('kategori')->pluck('kategori');
    }

    #[Computed]
    public function statistik(): array
    {
        return [
            'total' => Project::query()->count(),
            'berjalan' => Project::query()->where('status', 'in_progress')->count(),
            'selesai' => Project::query()->where('status', 'completed')->count(),
            'terlambat' => Project::query()->whereNotIn('status', ['completed', 'on_hold'])->whereDate('tanggal_selesai', '<', today())->count(),
            'anggota' => Karyawan::query()->count(),
            'tugas_aktif' => ProjectTask::query()->whereIn('status', ['pending', 'in_progress'])->count(),
            'tugas_selesai' => ProjectTask::query()->where('status', 'completed')->count(),
        ];
    }

    #[Computed]
    public function projectAktif(): ?Project
    {
        return $this->projectTugasId
            ? Project::query()->with(['anggota', 'tugas.karyawan'])->find($this->projectTugasId)
            : null;
    }

    public function tambah(): void
    {
        $this->resetForm();
    }

    public function ubah(int $projectId): void
    {
        $project = Project::query()->with('anggota')->findOrFail($projectId);

        $this->projectId = $project->id;
        $this->nama = $project->nama;
        $this->kategori = $project->kategori;
        $this->deskripsi = $project->deskripsi ?? '';
        $this->status = $project->status;
        $this->tanggalMulai = $project->tanggal_mulai?->format('Y-m-d') ?? '';
        $this->tanggalSelesai = $project->tanggal_selesai?->format('Y-m-d') ?? '';
        $this->anggotaTerpilih = $project->anggota->modelKeys();
        $this->resetValidation();
    }

    public function simpan(): void
    {
        $data = $this->validate([
            'nama' => ['required', 'string', 'max:180'],
            'kategori' => ['required', 'string', 'max:80'],
            'deskripsi' => ['nullable', 'string', 'max:3000'],
            'status' => ['required', Rule::in(array_keys(self::STATUS))],
            'tanggalMulai' => ['nullable', 'date'],
            'tanggalSelesai' => array_filter(['nullable', 'date', filled($this->tanggalMulai) ? 'after_or_equal:tanggalMulai' : null]),
            'anggotaTerpilih' => ['array'],
            'anggotaTerpilih.*' => ['integer', 'distinct', 'exists:karyawans,id'],
        ], [
            'tanggalSelesai.after_or_equal' => 'Tanggal selesai harus sama atau setelah tanggal mulai.',
        ]);

        $project = $this->projectId ? Project::query()->findOrFail($this->projectId) : new Project;
        $project->fill([
            'nama' => trim($data['nama']),
            'kategori' => trim($data['kategori']),
            'deskripsi' => filled($data['deskripsi']) ? trim($data['deskripsi']) : null,
            'status' => $data['status'],
            'tanggal_mulai' => $data['tanggalMulai'] ?: null,
            'tanggal_selesai' => $data['tanggalSelesai'] ?: null,
        ])->save();
        $project->anggota()->sync($data['anggotaTerpilih'] ?? []);

        $this->pesan = $this->projectId ? 'Project diperbarui.' : 'Project ditambahkan.';
        $this->resetForm();
        $this->dispatch('tutup-modal-project');
        unset($this->projects, $this->kategoriProyek, $this->statistik);
    }

    public function bukaTugas(int $projectId): void
    {
        Project::query()->findOrFail($projectId);
        $this->projectTugasId = $projectId;
        $this->resetTaskForm();
        unset($this->projectAktif);
    }

    public function simpanTugas(): void
    {
        $project = Project::query()->findOrFail($this->projectTugasId);
        $data = $this->validate([
            'namaTugas' => ['required', 'string', 'max:180'],
            'statusTugas' => ['required', Rule::in(array_keys(self::STATUS_TUGAS))],
            'tanggalTugas' => ['nullable', 'date'],
            'karyawanTugasId' => [
                'nullable',
                'integer',
                Rule::exists('karyawan_project', 'karyawan_id')->where('project_id', $project->id),
            ],
        ]);

        $project->tugas()->create([
            'nama' => trim($data['namaTugas']),
            'status' => $data['statusTugas'],
            'tanggal_selesai' => $data['tanggalTugas'] ?: null,
            'karyawan_id' => $data['karyawanTugasId'],
        ]);

        $this->pesan = 'Tugas ditambahkan.';
        $this->resetTaskForm();
        unset($this->projectAktif, $this->projects, $this->statistik);
    }

    public function ubahStatusTugas(int $taskId): void
    {
        $task = ProjectTask::query()->where('project_id', $this->projectTugasId)->findOrFail($taskId);
        $task->status = $task->status === 'completed' ? 'pending' : 'completed';
        $task->save();
        unset($this->projectAktif, $this->projects, $this->statistik);
    }

    public function mintaHapusProject(int $projectId): void
    {
        $this->hapusProjectId = Project::query()->findOrFail($projectId)->id;
    }

    public function hapusProject(): void
    {
        Project::query()->findOrFail($this->hapusProjectId)->delete();
        $this->hapusProjectId = null;
        $this->pesan = 'Project dihapus.';
        unset($this->projects, $this->kategoriProyek, $this->statistik);
    }

    public function hapusTugas(int $taskId): void
    {
        ProjectTask::query()->where('project_id', $this->projectTugasId)->findOrFail($taskId)->delete();
        $this->pesan = 'Tugas dihapus.';
        unset($this->projectAktif, $this->projects, $this->statistik);
    }

    /**
     * Tugas yang akan dihapus setelah konfirmasi.
     */
    public ?int $hapusTugasId = null;

    public function mintaHapusTugas(int $taskId): void
    {
        $this->hapusTugasId = $taskId;
    }

    public function konfirmasiHapusTugas(): void
    {
        if ($this->hapusTugasId === null) {
            return;
        }

        $taskId = $this->hapusTugasId;
        $this->hapusTugasId = null;
        $this->hapusTugas($taskId);
    }

    /**
     * Nama tugas yang akan dihapus, untuk pesan konfirmasi.
     */
    public function namaTugasHapus(): string
    {
        if ($this->hapusTugasId === null) {
            return '';
        }

        return (string) (ProjectTask::query()->find($this->hapusTugasId)?->nama ?? '');
    }

    public function render(): View
    {
        return view('livewire.projects');
    }

    private function resetForm(): void
    {
        $this->reset('projectId', 'nama', 'kategori', 'deskripsi', 'tanggalMulai', 'tanggalSelesai', 'anggotaTerpilih');
        $this->status = 'planned';
        $this->resetValidation();
    }

    private function resetTaskForm(): void
    {
        $this->reset('namaTugas', 'tanggalTugas', 'karyawanTugasId');
        $this->statusTugas = 'pending';
        $this->resetValidation(['namaTugas', 'tanggalTugas', 'karyawanTugasId', 'statusTugas']);
    }
}
