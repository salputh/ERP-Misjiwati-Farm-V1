<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\MasterStandarStrain;
use App\Models\Aktivitas;
use App\Models\Periode;
use App\Models\StandarStrain;
use App\Support\Standar;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class StandarStrainTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_standard_from_config_is_available_after_migration(): void
    {
        $standar = new Standar('Standar farm', 42);

        $this->assertSame(42, $standar->umurMaksimal());
        $this->assertSame(56.0, $standar->abw(1));
        $this->assertSame(225.0, $standar->pakanGram(42));
        $this->assertSame(0.1, $standar->deplesiPersen(1));
    }

    public function test_page_lists_strains_in_the_application_layout(): void
    {
        $this->get(route('standar-strain'))
            ->assertOk()
            ->assertSee('Standar farm')
            ->assertSee('42 hari')
            ->assertSee('Katalog template');
    }

    public function test_new_strain_starts_from_a_copy_of_the_first_standard_and_can_be_saved(): void
    {
        $halaman = Livewire::test(MasterStandarStrain::class)
            ->call('tambah')
            ->assertSet('hari.42.abw', '3097')
            ->set('nama', ' Cobb 500 ')
            ->set('hari.1.abw', '60')
            ->call('kurangiHari')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Standar strain Cobb 500 ditambahkan.');

        $strain = StandarStrain::where('nama', 'Cobb 500')->firstOrFail();
        $this->assertSame(41, $strain->harian()->count());
        $this->assertSame(60.0, (new Standar('Cobb 500', 42))->abw(1));
        $this->assertSame(41, (new Standar('Cobb 500', 42))->umurMaksimal());

        $this->assertDatabaseHas('aktivitas', [
            'jenis' => JenisAktivitas::Tambah->value,
            'modul' => ModulAktivitas::StandarStrain->value,
            'subjek' => 'Standar strain Cobb 500',
            'rincian' => '41 hari',
        ]);

        $halaman->assertSee('Cobb 500');
    }

    public function test_values_are_validated(): void
    {
        $strain = StandarStrain::firstOrFail();

        Livewire::test(MasterStandarStrain::class)
            ->call('ubah', $strain->id)
            ->set('nama', '')
            ->set('hari.3.abw', '0')
            ->set('hari.4.pakan_gram', '-1')
            ->set('hari.5.deplesi_persen', '101')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'required', 'hari.3.abw' => 'gt', 'hari.4.pakan_gram' => 'gte', 'hari.5.deplesi_persen' => 'between'])
            ->set('nama', 'Standar farm')
            ->call('tambah')
            ->set('nama', 'Standar farm')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'unique']);
    }

    public function test_renaming_a_strain_updates_its_periods_and_logs_only_real_changes(): void
    {
        $this->seed(DatabaseSeeder::class);
        $strain = StandarStrain::where('nama', 'Standar farm')->firstOrFail();
        $periode = Periode::where('strain', 'Standar farm')->firstOrFail();

        $halaman = Livewire::test(MasterStandarStrain::class)
            ->call('ubah', $strain->id)
            ->call('simpan')
            ->assertHasNoErrors();
        $this->assertSame(0, Aktivitas::count());

        $halaman->call('ubah', $strain->id)
            ->set('nama', 'Ross 308')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Standar strain Ross 308 diperbarui.');

        $this->assertSame('Ross 308', $periode->fresh()->strain);
        $this->assertSame(1, Aktivitas::where('jenis', JenisAktivitas::Ubah)->count());
    }

    public function test_strain_used_by_a_period_cannot_be_deleted_but_unused_one_can(): void
    {
        $this->seed(DatabaseSeeder::class);
        $dipakai = StandarStrain::where('nama', 'Standar farm')->firstOrFail();
        $cadangan = StandarStrain::create(['nama' => 'Cadangan']);

        Livewire::test(MasterStandarStrain::class)
            ->call('mintaHapus', $dipakai->id)
            ->call('hapus')
            ->assertHasErrors('hapus');
        $this->assertDatabaseHas('standar_strains', ['id' => $dipakai->id]);

        Livewire::test(MasterStandarStrain::class)
            ->call('mintaHapus', $cadangan->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Standar strain Cadangan dihapus.');

        $this->assertDatabaseMissing('standar_strains', ['id' => $cadangan->id]);
        $this->assertDatabaseHas('aktivitas', ['jenis' => JenisAktivitas::Hapus->value, 'subjek' => 'Standar strain Cadangan']);
    }
}
