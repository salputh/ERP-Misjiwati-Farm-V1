<?php

namespace Tests\Feature;

use App\Livewire\MasterPemanen;
use App\Models\Pemanen;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PemanenSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterPemanenTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_page_lists_harvesters_with_the_default_wage(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Daftar pemanen')
            ->assertSee('Rizal')
            ->assertSee('David')
            ->assertSee('Dayat')
            ->assertSee('Anju')
            ->assertSee('Kondom');

        $this->assertSame(5, Pemanen::query()->count());
        $this->assertSame([20, 20, 20, 20, 20], Pemanen::query()->pluck('upah_per_kg')->all());
    }

    public function test_harvesters_can_be_created_updated_and_deleted(): void
    {
        Livewire::test(MasterPemanen::class)
            ->call('tambah')
            ->set('nama', ' Budi ')
            ->set('upahPerKg', '35')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('nama', '')
            ->assertSet('pesan', 'Pemanen Budi ditambahkan.')
            ->assertSee('Budi');

        $pemanen = Pemanen::query()->where('nama', 'Budi')->firstOrFail();
        $this->assertSame(35, $pemanen->upah_per_kg);

        Livewire::test(MasterPemanen::class)
            ->call('ubah', $pemanen->id)
            ->assertSet('nama', 'Budi')
            ->assertSet('upahPerKg', '35')
            ->set('nama', 'Budi Diperbarui')
            ->set('upahPerKg', '45')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Pemanen Budi Diperbarui diperbarui.')
            ->assertSee('Budi Diperbarui');

        $this->assertDatabaseHas('pemanens', [
            'id' => $pemanen->id,
            'nama' => 'Budi Diperbarui',
            'upah_per_kg' => 45,
        ]);

        Livewire::test(MasterPemanen::class)
            ->call('mintaHapus', $pemanen->id)
            ->assertSet('namaHapus', 'Budi Diperbarui')
            ->call('hapus')
            ->assertSet('pesan', 'Pemanen Budi Diperbarui dihapus.')
            ->assertSee('Belum ada data pemanen.');

        $this->assertDatabaseMissing('pemanens', ['id' => $pemanen->id]);
    }

    public function test_harvester_name_must_be_unique_and_wage_a_nonnegative_whole_rupiah_amount(): void
    {
        $this->seed(PemanenSeeder::class);
        $pemanen = Pemanen::query()->where('nama', 'Rizal')->firstOrFail();

        Livewire::test(MasterPemanen::class)
            ->call('tambah')
            ->set('nama', ' ')
            ->set('upahPerKg', '-1')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'required', 'upahPerKg' => 'min']);

        Livewire::test(MasterPemanen::class)
            ->call('tambah')
            ->set('nama', 'Rizal')
            ->set('upahPerKg', '20.5')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'unique', 'upahPerKg' => 'integer']);

        $this->assertDatabaseHas('pemanens', [
            'id' => $pemanen->id,
            'upah_per_kg' => 20,
        ]);
    }

    public function test_seeding_does_not_overwrite_a_custom_harvester_wage(): void
    {
        $this->seed(PemanenSeeder::class);
        $pemanen = Pemanen::query()->where('nama', 'Rizal')->firstOrFail();
        $pemanen->update(['upah_per_kg' => 35]);

        $this->seed(PemanenSeeder::class);

        $this->assertDatabaseHas('pemanens', [
            'id' => $pemanen->id,
            'upah_per_kg' => 35,
        ]);
    }
}
