<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\MasterPremiAbk;
use App\Models\Aktivitas;
use App\Models\PremiAbk;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterPremiAbkTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_page_lists_the_premium_table_from_the_sheet(): void
    {
        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Premi ABK')
            ->assertSeeInOrder(['≥ Rp 5.500', '50', 'Rp 1.050.000', '≥ Rp 9.000', '225', 'Rp 4.200.000']);

        $this->assertSame(
            [[5_500, 50, 1_050_000], [6_000, 75, 1_500_000], [6_500, 100, 2_050_000], [7_000, 125, 2_500_000], [7_500, 150, 2_900_000], [8_000, 175, 3_300_000], [8_500, 200, 3_700_000], [9_000, 225, 4_200_000]],
            PremiAbk::orderBy('hasil_per_ekor')->get()->map(fn (PremiAbk $baris): array => [$baris->hasil_per_ekor, $baris->intensif, $baris->premi])->all(),
        );
    }

    public function test_highest_row_reached_applies(): void
    {
        $this->assertNull(PremiAbk::untukHasilPerEkor(5_499.99));
        $this->assertSame(1_050_000, PremiAbk::untukHasilPerEkor(5_500)->premi);
        $this->assertSame(2_500_000, PremiAbk::untukHasilPerEkor(7_087.18)->premi);
        $this->assertSame(4_200_000, PremiAbk::untukHasilPerEkor(12_000)->premi);
    }

    public function test_rows_can_be_created_updated_and_deleted_with_activity(): void
    {
        $halaman = Livewire::test(MasterPremiAbk::class)
            ->call('tambah')
            ->set('hasilPerEkor', '9500')
            ->set('intensif', '250')
            ->set('premi', '4600000')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Premi ABK Rp 9.500 per ekor ditambahkan.')
            ->assertSee('Rp 4.600.000');

        $baris = PremiAbk::where('hasil_per_ekor', 9_500)->sole();
        $this->assertSame([250, 4_600_000], [$baris->intensif, $baris->premi]);

        $halaman->call('ubah', $baris->id)
            ->assertSet('premi', '4600000')
            ->set('premi', '4700000')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Premi ABK Rp 9.500 per ekor diperbarui.');
        $this->assertSame(4_700_000, $baris->fresh()->premi);

        $halaman->call('mintaHapus', $baris->id)
            ->call('hapus')
            ->assertSet('pesan', 'Premi ABK Rp 9.500 per ekor dihapus.');
        $this->assertDatabaseMissing('premi_abks', ['id' => $baris->id]);

        $this->assertSame(
            [JenisAktivitas::Tambah, JenisAktivitas::Ubah, JenisAktivitas::Hapus],
            Aktivitas::where('modul', ModulAktivitas::MasterData)->orderBy('id')->pluck('jenis')->all(),
        );
    }

    public function test_threshold_must_be_unique_and_values_valid(): void
    {
        Livewire::test(MasterPremiAbk::class)
            ->call('tambah')
            ->set('hasilPerEkor', '5500')
            ->set('intensif', '')
            ->set('premi', '-1')
            ->call('simpan')
            ->assertHasErrors(['hasilPerEkor' => 'unique', 'intensif' => 'required', 'premi' => 'min']);

        $this->assertSame(8, PremiAbk::count());
    }
}
