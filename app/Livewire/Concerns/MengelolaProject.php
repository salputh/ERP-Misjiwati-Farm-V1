<?php

namespace App\Livewire\Concerns;

use App\Livewire\Projects;
use App\Models\Karyawan;
use App\Models\Project;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Computed;

/**
 * Form buat dan ubah project (modal x-project.form), dipakai halaman daftar dan halaman detail project.
 */
trait MengelolaProject
{
    public ?int $projectId = null;

    public string $nama = '';

    public string $kategori = '';

    public string $deskripsi = '';

    public string $status = 'planned';

    public string $tanggalMulai = '';

    public string $tanggalSelesai = '';

    /** @var list<int|string> */
    public array $anggotaTerpilih = [];

    public string $pesan = '';

    #[Computed]
    public function karyawan(): Collection
    {
        return Karyawan::query()->with('kandang')->orderBy('nama')->get();
    }

    /**
     * Pilihan saringan anggota di form project: satu per kandang, lalu karyawan yang belum ditempatkan.
     * Kunci sama dengan data-kandang tiap karyawan di daftar pilihan ("tanpa" untuk yang belum ditempatkan).
     *
     * @return list<array{kunci: string, label: string, jumlah: int}>
     */
    #[Computed]
    public function kelompokKaryawan(): array
    {
        return $this->karyawan
            ->groupBy(fn (Karyawan $orang): string => (string) ($orang->kandang_id ?? 'tanpa'))
            ->map(fn (Collection $orang, string $kunci): array => [
                'kunci' => $kunci,
                'label' => $orang->first()->kandang?->nama ?? 'Belum ditempatkan',
                'jumlah' => $orang->count(),
            ])
            ->sortBy(fn (array $kelompok): string => $kelompok['kunci'] === 'tanpa' ? "\u{FFFF}" : $kelompok['label'])
            ->values()
            ->all();
    }

    #[Computed]
    public function kategoriProyek(): SupportCollection
    {
        return Project::query()->select('kategori')->distinct()->orderBy('kategori')->pluck('kategori');
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
            'status' => ['required', Rule::in(array_keys(Projects::STATUS))],
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
        unset($this->kategoriProyek);
        $this->setelahProjectDisimpan();
    }

    /**
     * Segarkan data halaman yang bergantung pada project setelah form disimpan.
     */
    abstract protected function setelahProjectDisimpan(): void;

    private function resetForm(): void
    {
        $this->reset('projectId', 'nama', 'kategori', 'deskripsi', 'tanggalMulai', 'tanggalSelesai', 'anggotaTerpilih');
        $this->status = 'planned';
        $this->resetValidation();
    }
}
