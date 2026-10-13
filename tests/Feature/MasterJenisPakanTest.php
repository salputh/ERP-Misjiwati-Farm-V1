<?php

namespace Tests\Feature;

use App\Livewire\MasterJenisPakan;
use App\Models\JenisPakan;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterJenisPakanTest extends TestCase
{
    use RefreshDatabase;

    public function test_page_lists_feed_types_in_the_application_layout(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Daftar jenis pakan')
            ->assertSee('SB-10')
            ->assertSee('SB-11')
            ->assertSee('SB-12')
            ->assertDontSee('userDatatable-title">Penerimaan')
            ->assertDontSee('userDatatable-title">Pemberian')
            ->assertSee('Katalog template');
    }

    public function test_legacy_feed_type_url_redirects_to_the_unified_master_page(): void
    {
        $this->get(route('jenis-pakan'))
            ->assertRedirect(route('master-data'));
    }

    public function test_feed_types_can_be_created_updated_and_deleted(): void
    {
        $halaman = Livewire::test(MasterJenisPakan::class)
            ->call('tambah')
            ->set('kode', ' sb-20 ')
            ->set('hargaPerKg', '8500')
            ->set('kgPerZak', '45')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('SB-20')
            ->assertSet('pesan', 'Jenis pakan SB-20 ditambahkan.');

        $jenisPakan = JenisPakan::where('kode', 'SB-20')->firstOrFail();
        $this->assertSame([8500, 45.0], [$jenisPakan->harga_per_kg, $jenisPakan->kg_per_zak]);

        $halaman->call('ubah', $jenisPakan->id)
            ->assertSet('kode', 'SB-20')
            ->set('kode', 'sb-21')
            ->set('hargaPerKg', '9000')
            ->set('kgPerZak', '50')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('SB-21')
            ->assertSet('pesan', 'Jenis pakan SB-21 diperbarui.')
            ->call('mintaHapus', $jenisPakan->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Jenis pakan SB-21 dihapus.');

        $this->assertDatabaseMissing('jenis_pakans', ['id' => $jenisPakan->id]);
    }

    public function test_feed_type_code_is_required_and_unique(): void
    {
        JenisPakan::factory()->create(['kode' => 'SB-10']);

        Livewire::test(MasterJenisPakan::class)
            ->call('tambah')
            ->call('simpan')
            ->assertHasErrors(['kode' => 'required'])
            ->set('kode', 'sb-10')
            ->set('hargaPerKg', '8500')
            ->set('kgPerZak', '50')
            ->call('simpan')
            ->assertHasErrors(['kode' => 'unique']);
    }

    public function test_price_and_bag_weight_must_be_positive(): void
    {
        Livewire::test(MasterJenisPakan::class)
            ->call('tambah')
            ->set('kode', 'SB-20')
            ->set('hargaPerKg', '0')
            ->set('kgPerZak', '0')
            ->call('simpan')
            ->assertHasErrors(['hargaPerKg' => 'min', 'kgPerZak' => 'gt']);
    }

    public function test_feed_type_in_use_cannot_be_deleted(): void
    {
        $this->seed(DatabaseSeeder::class);

        $periode = Periode::query()->firstOrFail();
        $periodeKandang = PeriodeKandang::query()->firstOrFail();
        $dipakaiPada = [
            JenisPakan::factory()->create(['kode' => 'SB-20']),
            JenisPakan::factory()->create(['kode' => 'SB-21']),
        ];

        PenerimaanPakan::factory()->create([
            'jenis_pakan_id' => $dipakaiPada[0]->id,
            'periode_id' => $periode->id,
        ]);
        PemberianPakan::factory()->create([
            'jenis_pakan_id' => $dipakaiPada[1]->id,
            'periode_kandang_id' => $periodeKandang->id,
            'tanggal' => $periode->tanggal_chick_in,
            'umur' => 1,
        ]);

        foreach ($dipakaiPada as $jenisPakan) {
            Livewire::test(MasterJenisPakan::class)
                ->call('mintaHapus', $jenisPakan->id)
                ->call('hapus')
                ->assertHasErrors(['hapus'])
                ->assertSee('sudah digunakan pada data penerimaan atau pemberian');

            $this->assertDatabaseHas('jenis_pakans', ['id' => $jenisPakan->id]);
        }
    }
}
