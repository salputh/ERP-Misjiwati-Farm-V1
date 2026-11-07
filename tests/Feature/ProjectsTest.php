<?php

namespace Tests\Feature;

use App\Livewire\ProjectDetail as ProjectDetailPage;
use App\Livewire\Projects as ProjectsPage;
use App\Models\Farm;
use App\Models\Kandang;
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

    public function test_member_picker_can_be_filtered_per_house(): void
    {
        $farm = Farm::query()->create(['nama' => 'Farm Uji']);
        $kandangSatu = Kandang::query()->create(['farm_id' => $farm->id, 'nama' => 'Kandang 1', 'kapasitas' => 10000]);
        $kandangDua = Kandang::query()->create(['farm_id' => $farm->id, 'nama' => 'Kandang 2', 'kapasitas' => 10000]);
        Karyawan::factory()->count(2)->create(['kandang_id' => $kandangSatu->id]);
        $abkDua = Karyawan::factory()->create(['nama' => 'Igo', 'kandang_id' => $kandangDua->id]);
        $tanpaKandang = Karyawan::factory()->create(['nama' => 'Baru']);

        Livewire::test(ProjectsPage::class)
            ->assertSet('kelompokKaryawan', [
                ['kunci' => (string) $kandangSatu->id, 'label' => 'Kandang 1', 'jumlah' => 2],
                ['kunci' => (string) $kandangDua->id, 'label' => 'Kandang 2', 'jumlah' => 1],
                ['kunci' => 'tanpa', 'label' => 'Belum ditempatkan', 'jumlah' => 1],
            ])
            ->assertSee('Semua (4)')
            ->assertSee('Kandang 1 (2)')
            ->assertSee('Kandang 2 (1)')
            ->assertSeeHtml("x-on:click=\"kandang = '{$kandangDua->id}'\"")
            ->assertSeeHtml("wire:key=\"pilih-anggota-{$abkDua->id}\" x-show=\"kandang === 'semua' || kandang === '{$kandangDua->id}'\"")
            ->assertSeeHtml("wire:key=\"pilih-anggota-{$tanpaKandang->id}\" x-show=\"kandang === 'semua' || kandang === 'tanpa'\"");
    }

    public function test_tasks_update_project_progress_and_only_project_members_can_be_assignees(): void
    {
        $project = Project::factory()->create(['status' => 'in_progress']);
        $anggota = Karyawan::factory()->create();
        $bukanAnggota = Karyawan::factory()->create();
        $project->anggota()->attach($anggota);
        $tugasSelesai = ProjectTask::factory()->create(['project_id' => $project->id, 'nama' => 'Periksa kipas', 'status' => 'completed']);
        ProjectTask::factory()->create(['project_id' => $project->id, 'nama' => 'Ganti belt', 'status' => 'pending']);

        Livewire::test(ProjectsPage::class)
            ->assertSee('1 / 2 tugas selesai')
            ->assertSee('50%');

        $halaman = Livewire::test(ProjectDetailPage::class, ['project' => $project])
            ->assertSee('50%')
            ->call('tambahTugas')
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

    public function test_project_cards_link_to_the_detail_page_and_list_view_shows_a_table(): void
    {
        $project = Project::factory()->create(['nama' => 'Pasang jaring rak', 'status' => 'completed']);

        Livewire::test(ProjectsPage::class)
            ->assertSeeHtml('href="'.route('project.show', $project).'"')
            ->assertSeeHtml('project-kartu--completed')
            ->assertDontSeeHtml('<table')
            ->call('pilihTampilan', 'list')
            ->assertSet('tampilan', 'list')
            ->assertSeeHtml('<table')
            ->assertSee('Pasang jaring rak');

        $this->get(route('project.show', $project))
            ->assertOk()
            ->assertSee('Pasang jaring rak')
            ->assertSee('Tentang project')
            ->assertSee('Daftar tugas');
    }

    public function test_project_list_is_paginated(): void
    {
        Project::factory()->count(13)->create(['status' => 'planned']);

        Livewire::test(ProjectsPage::class)
            ->assertCount('projects', 12)
            ->assertSeeHtml('dm-pagination')
            ->call('pilihPerHalaman', 24)
            ->assertCount('projects', 13);
    }

    public function test_detail_page_marks_a_project_complete_and_reopens_it(): void
    {
        $project = Project::factory()->create(['status' => 'in_progress']);

        $halaman = Livewire::test(ProjectDetailPage::class, ['project' => $project])
            ->assertSee('Tandai selesai')
            ->call('ubahStatusProject')
            ->assertSet('pesan', 'Project ditandai selesai.')
            ->assertSee('Sudah selesai');
        $this->assertSame('completed', $project->fresh()->status);

        $halaman->call('ubahStatusProject')
            ->assertSet('pesan', 'Project dibuka kembali.');
        $this->assertSame('in_progress', $project->fresh()->status);
    }

    public function test_deleting_project_from_the_detail_page_returns_to_the_list(): void
    {
        $project = Project::factory()->create();

        Livewire::test(ProjectDetailPage::class, ['project' => $project])
            ->call('hapusProject')
            ->assertRedirect(route('project.index'));

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
        Livewire::test(ProjectsPage::class)->assertSet('pesan', 'Project dihapus.');
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
