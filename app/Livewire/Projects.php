<?php

namespace App\Livewire;

use App\Livewire\Concerns\MengelolaProject;
use App\Models\Project;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;
use Livewire\WithPagination;

#[Title('Project')]
class Projects extends Component
{
    use MengelolaProject;
    use WithPagination;

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

    /** Pilihan jumlah project per halaman, seperti "20/page" pada halaman Project template. */
    public const PER_HALAMAN = [12, 24, 48];

    public string $cari = '';

    public string $filterStatus = 'all';

    public string $filterKategori = 'all';

    /** Tampilan daftar: grid (kartu) atau list (tabel). */
    #[Url(as: 'tampilan')]
    public string $tampilan = 'grid';

    public int $perHalaman = 12;

    public ?int $hapusProjectId = null;

    /**
     * Pesan dari halaman detail, misalnya setelah project dihapus lalu dialihkan ke sini.
     */
    public function mount(): void
    {
        $this->pesan = (string) session('pesan-project', '');
    }

    #[Computed]
    public function projects(): LengthAwarePaginator
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
            ->paginate($this->perHalaman);
    }

    /**
     * Jumlah project berjalan untuk kepala halaman ("12 Running projects" di template).
     */
    #[Computed]
    public function jumlahBerjalan(): int
    {
        return Project::query()->where('status', 'in_progress')->count();
    }

    public function updated(string $properti): void
    {
        if (in_array($properti, ['cari', 'filterStatus', 'filterKategori', 'perHalaman'], true)) {
            $this->resetPage();
        }
    }

    public function pilihTampilan(string $tampilan): void
    {
        $this->tampilan = $tampilan === 'list' ? 'list' : 'grid';
    }

    public function pilihPerHalaman(int $jumlah): void
    {
        $this->perHalaman = in_array($jumlah, self::PER_HALAMAN, true) ? $jumlah : self::PER_HALAMAN[0];
        $this->resetPage();
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
        unset($this->projects, $this->kategoriProyek, $this->jumlahBerjalan);
    }

    /**
     * Nama project yang akan dihapus, untuk pesan konfirmasi.
     */
    public function namaProjectHapus(): string
    {
        return $this->hapusProjectId ? (string) Project::query()->find($this->hapusProjectId)?->nama : '';
    }

    public function paginationView(): string
    {
        return 'vendor.pagination.basalt';
    }

    public function render(): View
    {
        return view('livewire.projects');
    }

    protected function setelahProjectDisimpan(): void
    {
        unset($this->projects, $this->jumlahBerjalan);
    }
}
