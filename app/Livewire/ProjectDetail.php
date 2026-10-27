<?php

namespace App\Livewire;

use App\Livewire\Concerns\MengelolaProject;
use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Component;

/**
 * Detail satu project mengikuti halaman Project Detail template: progres, ringkasan tugas, tentang project,
 * anggota, daftar tugas, dan aktivitas tugas.
 */
class ProjectDetail extends Component
{
    use MengelolaProject;

    #[Locked]
    public int $projectDetailId;

    public string $namaTugas = '';

    public string $statusTugas = 'pending';

    public ?string $tanggalTugas = null;

    public ?int $karyawanTugasId = null;

    public ?int $hapusTugasId = null;

    public function mount(Project $project): void
    {
        $this->projectDetailId = $project->id;
    }

    #[Computed]
    public function project(): Project
    {
        return Project::query()
            ->with(['anggota.kandang', 'tugas' => fn ($query) => $query->with('karyawan')->orderByRaw('tanggal_selesai IS NULL')->orderBy('tanggal_selesai')->orderBy('id')])
            ->findOrFail($this->projectDetailId);
    }

    /**
     * Angka ringkasan di bawah kotak progres (application-task template), dengan ikon dan warnanya.
     *
     * @return list<array{nilai: int, label: string, ikon: string, warna: string}>
     */
    #[Computed]
    public function ringkasan(): array
    {
        $tugas = $this->project->tugas;

        return [
            ['nilai' => $tugas->count(), 'label' => 'Total tugas', 'ikon' => 'at.svg', 'warna' => 'secondary'],
            ['nilai' => $tugas->where('status', 'completed')->count(), 'label' => 'Tugas selesai', 'ikon' => 'at2.svg', 'warna' => 'primary'],
            ['nilai' => $tugas->where('status', '!=', 'completed')->count(), 'label' => 'Belum selesai', 'ikon' => 'at4.svg', 'warna' => 'success'],
            ['nilai' => $this->project->anggota->count(), 'label' => 'Anggota', 'ikon' => 'at3.svg', 'warna' => 'warning'],
        ];
    }

    /**
     * Aktivitas tugas per hari, terbaru di atas: tugas ditambahkan (created_at) dan tugas diselesaikan (updated_at).
     *
     * @return Collection<string, Collection<int, array{waktu: Carbon, selesai: bool, nama: string, karyawan: ?string}>>
     */
    #[Computed]
    public function aktivitas(): Collection
    {
        return $this->project->tugas
            ->flatMap(fn (ProjectTask $tugas): array => array_filter([
                ['waktu' => $tugas->created_at, 'selesai' => false, 'nama' => $tugas->nama, 'karyawan' => $tugas->karyawan?->nama],
                $tugas->status === 'completed'
                    ? ['waktu' => $tugas->updated_at, 'selesai' => true, 'nama' => $tugas->nama, 'karyawan' => $tugas->karyawan?->nama]
                    : null,
            ]))
            ->sortByDesc('waktu')
            ->groupBy(fn (array $kejadian): string => $kejadian['waktu']->toDateString());
    }

    public function ubahProject(): void
    {
        $this->ubah($this->projectDetailId);
    }

    public function tambahTugas(): void
    {
        $this->resetTaskForm();
    }

    public function simpanTugas(): void
    {
        $data = $this->validate([
            'namaTugas' => ['required', 'string', 'max:180'],
            'statusTugas' => ['required', Rule::in(array_keys(Projects::STATUS_TUGAS))],
            'tanggalTugas' => ['nullable', 'date'],
            'karyawanTugasId' => [
                'nullable',
                'integer',
                Rule::exists('karyawan_project', 'karyawan_id')->where('project_id', $this->projectDetailId),
            ],
        ]);

        $this->project->tugas()->create([
            'nama' => trim($data['namaTugas']),
            'status' => $data['statusTugas'],
            'tanggal_selesai' => $data['tanggalTugas'] ?: null,
            'karyawan_id' => $data['karyawanTugasId'],
        ]);

        $this->pesan = 'Tugas ditambahkan.';
        $this->resetTaskForm();
        $this->dispatch('tutup-modal-tugas');
        $this->segarkan();
    }

    public function ubahStatusTugas(int $taskId): void
    {
        $task = ProjectTask::query()->where('project_id', $this->projectDetailId)->findOrFail($taskId);
        $task->status = $task->status === 'completed' ? 'pending' : 'completed';
        $task->save();
        $this->segarkan();
    }

    /**
     * Tombol "Tandai selesai": project selesai kembali berjalan, selain itu ditandai selesai.
     */
    public function ubahStatusProject(): void
    {
        $project = $this->project;
        $project->status = $project->status === 'completed' ? 'in_progress' : 'completed';
        $project->save();
        $this->pesan = $project->status === 'completed' ? 'Project ditandai selesai.' : 'Project dibuka kembali.';
        $this->segarkan();
    }

    public function mintaHapusTugas(int $taskId): void
    {
        $this->hapusTugasId = ProjectTask::query()->where('project_id', $this->projectDetailId)->findOrFail($taskId)->id;
    }

    public function hapusTugas(): void
    {
        if ($this->hapusTugasId === null) {
            return;
        }

        ProjectTask::query()->where('project_id', $this->projectDetailId)->findOrFail($this->hapusTugasId)->delete();
        $this->hapusTugasId = null;
        $this->pesan = 'Tugas dihapus.';
        $this->segarkan();
    }

    /**
     * Nama tugas yang akan dihapus, untuk pesan konfirmasi.
     */
    public function namaTugasHapus(): string
    {
        return $this->hapusTugasId ? (string) $this->project->tugas->firstWhere('id', $this->hapusTugasId)?->nama : '';
    }

    public function hapusProject(): void
    {
        $this->project->delete();
        session()->flash('pesan-project', 'Project dihapus.');
        $this->redirectRoute('project.index');
    }

    public function render(): View
    {
        return view('livewire.project-detail')->title($this->project->nama);
    }

    protected function setelahProjectDisimpan(): void
    {
        $this->segarkan();
    }

    private function segarkan(): void
    {
        unset($this->project, $this->ringkasan, $this->aktivitas);
    }

    private function resetTaskForm(): void
    {
        $this->reset('namaTugas', 'tanggalTugas', 'karyawanTugasId');
        $this->statusTugas = 'pending';
        $this->resetValidation(['namaTugas', 'tanggalTugas', 'karyawanTugasId', 'statusTugas']);
    }
}
