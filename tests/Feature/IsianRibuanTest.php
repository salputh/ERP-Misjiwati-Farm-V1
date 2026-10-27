<?php

namespace Tests\Feature;

use App\Livewire\KasOperasional;
use App\Livewire\Panen;
use App\Models\Kandang;
use App\Models\Periode;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Isian angka yang biasa berisi ribuan memakai x-masukan.ribuan, supaya pemisah ribuannya tampil saat diketik.
 */
class IsianRibuanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_money_and_head_count_inputs_show_thousand_separators(): void
    {
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(KasOperasional::class, ['kandang' => Kandang::where('nama', 'Kandang 2')->firstOrFail()])
            ->assertSeeHtml("x-data=\"isianRibuan('jumlah', '.', false, { desimal: 0, teks: true })\"")
            ->assertDontSeeHtml('wire:model="jumlah"');

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(Panen::class)
            ->assertSeeHtml("isianRibuan('ekor', '.', false, { desimal: 0, teks: true })")
            ->assertSeeHtml("isianRibuan('beratKg', '.', false, { desimal: 2, teks: true })")
            ->assertSeeHtml("isianRibuan('nettoNotaKg', '.', false, { desimal: 2, teks: true })")
            ->assertSeeHtml('inputmode="decimal"');
    }

    /**
     * Mode teks mengirim string; mengosongkan isian mengirim '' sehingga properti string tetap ada dan validasi
     * menolaknya dengan pesan biasa.
     */
    public function test_a_cleared_text_mode_input_is_rejected_by_validation_instead_of_breaking_the_page(): void
    {
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        Livewire::withQueryParams(['periode' => $september->id])
            ->test(KasOperasional::class, ['kandang' => Kandang::where('nama', 'Kandang 2')->firstOrFail()])
            ->set('jumlah', '1500000')
            ->set('jumlah', '')
            ->assertOk()
            ->call('simpan')
            ->assertHasErrors(['jumlah' => 'required']);
    }
}
