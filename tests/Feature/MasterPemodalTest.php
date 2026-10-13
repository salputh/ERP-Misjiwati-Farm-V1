<?php

namespace Tests\Feature;

use App\Livewire\MasterPemodal;
use App\Models\Kandang;
use App\Models\Pemodal;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterPemodalTest extends TestCase
{
    use RefreshDatabase;

    public function test_page_lists_investors_and_their_fixed_house_shares(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Daftar pemodal')
            ->assertSee('Muchrizan')
            ->assertSee('Chatam')
            ->assertSee('Porsi Kandang 1')
            ->assertSee('79,9%')
            ->assertSee('20,1%')
            ->assertSee(route('master-data'), false);
    }

    public function test_legacy_investor_url_redirects_to_the_unified_master_page(): void
    {
        $this->get(route('pemodal'))
            ->assertRedirect(route('master-data'));
    }

    public function test_investors_and_their_house_shares_can_be_created_updated_and_deleted(): void
    {
        $kandangSatu = Kandang::create(['nama' => 'Kandang 1', 'kapasitas' => 100]);
        $kandangDua = Kandang::create(['nama' => 'Kandang 2', 'kapasitas' => 100]);

        $halaman = Livewire::test(MasterPemodal::class)
            ->call('tambah')
            ->set('nama', 'Investor Baru')
            ->set('porsiKandang.'.$kandangSatu->id, '10')
            ->set('porsiKandang.'.$kandangDua->id, '25.5')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSee('Investor Baru')
            ->assertSet('pesan', 'Pemodal Investor Baru ditambahkan.');

        $pemodal = Pemodal::where('nama', 'Investor Baru')->firstOrFail();
        $this->assertEquals(10, $pemodal->kandangs->firstWhere('id', $kandangSatu->id)->pivot->persen);
        $this->assertEquals(25.5, $pemodal->kandangs->firstWhere('id', $kandangDua->id)->pivot->persen);

        $halaman->call('ubah', $pemodal->id)
            ->assertSet('nama', 'Investor Baru')
            ->set('nama', 'Investor Diperbarui')
            ->set('porsiKandang.'.$kandangSatu->id, '15')
            ->set('porsiKandang.'.$kandangDua->id, '')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Pemodal Investor Diperbarui diperbarui.')
            ->call('mintaHapus', $pemodal->id)
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Pemodal Investor Diperbarui dihapus.');

        $this->assertDatabaseMissing('pemodals', ['id' => $pemodal->id]);
        $this->assertDatabaseMissing('kandang_pemodal', ['pemodal_id' => $pemodal->id]);
    }

    public function test_investor_name_and_house_share_totals_are_validated(): void
    {
        $this->seed(DatabaseSeeder::class);
        $kandangSatu = Kandang::where('nama', 'Kandang 1')->firstOrFail();

        Livewire::test(MasterPemodal::class)
            ->call('tambah')
            ->set('nama', ' ')
            ->set('porsiKandang.'.$kandangSatu->id, '0.0001')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'required', 'porsiKandang.'.$kandangSatu->id => 'decimal']);

        Livewire::test(MasterPemodal::class)
            ->call('tambah')
            ->set('nama', 'Investor Berlebih')
            ->set('porsiKandang.'.$kandangSatu->id, '0.101')
            ->call('simpan')
            ->assertHasErrors(['porsiKandang.'.$kandangSatu->id])
            ->assertSee('tidak boleh lebih dari 100%.');

        Livewire::test(MasterPemodal::class)
            ->call('tambah')
            ->set('nama', 'Chatam')
            ->call('simpan')
            ->assertHasErrors(['nama' => 'unique']);
    }

    public function test_master_shares_are_used_by_bagi_hasil_when_a_period_has_no_saved_investor_split(): void
    {
        $this->seed(DatabaseSeeder::class);
        $kandang = Kandang::where('nama', 'Kandang 1')->firstOrFail();
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $muchrizan = Pemodal::where('nama', 'Muchrizan')->firstOrFail();

        Livewire::test(MasterPemodal::class)
            ->call('ubah', $muchrizan->id)
            ->set('porsiKandang.'.$kandang->id, '60')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->get(route('bagi.hasil', ['kandang' => $kandang->id, 'periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Muchrizan')
            ->assertSee('60%')
            ->assertSee('Chatam')
            ->assertSee('20,1%');

        $periodeKandang = PeriodeKandang::where([
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
        ])->firstOrFail();
        $this->assertDatabaseMissing('penerima_bagi_hasils', [
            'bagi_hasil_id' => $periodeKandang->bagiHasil->id,
            'peran' => 'pemodal',
        ]);
    }
}
