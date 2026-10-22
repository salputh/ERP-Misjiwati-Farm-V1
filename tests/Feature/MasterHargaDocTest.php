<?php

namespace Tests\Feature;

use App\Livewire\MasterHargaDoc;
use App\Models\HargaDoc;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MasterHargaDocTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_page_shows_the_default_global_doc_values(): void
    {
        $this->get(route('master-data'))
            ->assertOk()
            ->assertSee('Master harga DOC')
            ->assertSee('Rp 9.415')
            ->assertSee('26.000 ekor');

        $this->assertDatabaseHas('harga_docs', [
            'id' => HargaDoc::GLOBAL_ID,
            'harga_per_ekor' => 9415,
            'jumlah_ekor' => 26000,
        ]);
    }

    public function test_global_doc_values_can_be_updated(): void
    {
        Livewire::test(MasterHargaDoc::class)
            ->call('ubah')
            ->assertSet('hargaPerEkor', '9415')
            ->assertSet('jumlahEkor', '26000')
            ->set('hargaPerEkor', '9500')
            ->set('jumlahEkor', '27000')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Master harga DOC diperbarui.')
            ->assertSee('Rp 9.500')
            ->assertSee('27.000 ekor');

        $this->assertDatabaseHas('harga_docs', [
            'id' => HargaDoc::GLOBAL_ID,
            'harga_per_ekor' => 9500,
            'jumlah_ekor' => 27000,
        ]);
    }

    public function test_doc_price_and_quantity_must_be_positive_whole_numbers(): void
    {
        Livewire::test(MasterHargaDoc::class)
            ->call('ubah')
            ->set('hargaPerEkor', '0')
            ->set('jumlahEkor', '1.5')
            ->call('simpan')
            ->assertHasErrors([
                'hargaPerEkor' => 'min',
                'jumlahEkor' => 'integer',
            ]);

        $this->assertDatabaseHas('harga_docs', [
            'id' => HargaDoc::GLOBAL_ID,
            'harga_per_ekor' => 9415,
            'jumlah_ekor' => 26000,
        ]);
    }
}
