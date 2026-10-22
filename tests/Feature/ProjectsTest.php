<?php

namespace Tests\Feature;

use App\Livewire\Projects as ProjectsPage;
use App\Models\Karyawan;
use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class ProjectsTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_page_lists_projects_and_filters_overdue_items(): void
    {
        Project::factory()->create([
            'nama' => 'Perbaikan kandang aktif',
            'status' => 'in_progress',
            'tanggal_selesai' => today()->addWeek(),
        ]);
        Project::factory()->create([
            'nama' => 'Pengecatan kandang terlambat',
            'status' => 'in_progress',
            'tanggal_selesai' => today()->subDay(),
        ]);

        $this->get(route('project.index'))
            ->assertOk()
            ->assertSee('Perbaikan kandang aktif')
            ->assertSee('Pengecatan kandang terlambat')
            ->assertSee('Semua project');

        Livewire::test(ProjectsPage::class)
            ->set('filterStatus', 'overdue')
            ->assertSee('Pengecatan kandang terlambat')
            ->assertDontSee('Perbaikan kandang aktif');
    }

    public function test_projects_can_be_created_updated_and_assigned_to_employees(): void
    {
        $anggota = Karyawan::factory()->create(['nama' => 'Sari']);

        $halaman = Livewire::test(ProjectsPage::class)
            ->call('tambah')
            ->set('nama', 'Perawatan kandang')
            ->set('kategori', 'Perawatan')
            ->set('deskripsi', 'Pemeriksaan rutin kandang')
            ->set('status', 'in_progress')
            ->set('tanggalMulai', '2026-10-15')
            ->set('tanggalSelesai', '2026-10-25')
            ->set('anggotaTerpilih', [$anggota->id])
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Project ditambahkan.');

        $project = Project::query()->where('nama', 'Perawatan kandang')->firstOrFail();
        $this->assertSame([$anggota->id], $project->anggota()->pluck('karyawans.id')->all());

        $halaman->call('ubah', $project->id)
            ->set('nama', 'Perawatan kandang berkala')
            ->set('status', 'completed')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Project diperbarui.');

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'nama' => 'Perawatan kandang berkala', 'status' => 'completed']);
        $this->assertDatabaseHas('karyawan_project', ['project_id' => $project->id, 'karyawan_id' => $anggota->id]);
    }

    public function test_tasks_update_project_progress_and_only_project_members_can_be_assignees(): void
    {
        $project = Project::factory()->create(['status' => 'in_progress']);
        $anggota = Karyawan::factory()->create();
        $bukanAnggota = Karyawan::factory()->create();
        $project->anggota()->attach($anggota);
        $tugasSelesai = ProjectTask::factory()->create(['project_id' => $project->id, 'nama' => 'Periksa kipas', 'status' => 'completed']);
        ProjectTask::factory()->create(['project_id' => $project->id, 'nama' => 'Ganti belt', 'status' => 'pending']);

        $halaman = Livewire::test(ProjectsPage::class)
            ->assertSee('1 / 2 tugas')
            ->assertSee('50%')
            ->call('bukaTugas', $project->id)
            ->set('namaTugas', 'Uji ventilasi')
            ->set('karyawanTugasId', $anggota->id)
            ->call('simpanTugas')
            ->assertHasNoErrors()
            ->assertSee('Uji ventilasi');

        $this->assertDatabaseHas('project_tasks', [
            'project_id' => $project->id,
            'nama' => 'Uji ventilasi',
            'karyawan_id' => $anggota->id,
        ]);

        $halaman->set('namaTugas', 'Tugas orang luar')
            ->set('karyawanTugasId', $bukanAnggota->id)
            ->call('simpanTugas')
            ->assertHasErrors(['karyawanTugasId' => 'exists']);

        $halaman->call('ubahStatusTugas', $tugasSelesai->id)
            ->assertSee('0%');
        $this->assertDatabaseHas('project_tasks', ['id' => $tugasSelesai->id, 'status' => 'pending']);
    }

    public function test_deleting_project_removes_its_tasks_and_membership(): void
    {
        $project = Project::factory()->create();
        $anggota = Karyawan::factory()->create();
        $project->anggota()->attach($anggota);
        $task = ProjectTask::factory()->create(['project_id' => $project->id]);

        Livewire::test(ProjectsPage::class)
            ->call('mintaHapusProject', $project->id)
            ->call('hapusProject')
            ->assertSet('pesan', 'Project dihapus.');

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
        $this->assertDatabaseMissing('project_tasks', ['id' => $task->id]);
        $this->assertDatabaseMissing('karyawan_project', ['project_id' => $project->id]);
    }
}
