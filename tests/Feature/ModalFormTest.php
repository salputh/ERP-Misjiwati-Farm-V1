<?php

namespace Tests\Feature;

use App\Livewire\FormLaporanHarian;
use App\Livewire\KasOperasional;
use App\Livewire\LogPemberianPakan;
use App\Livewire\ManajemenPeriode;
use App\Livewire\MasterHargaDoc;
use App\Livewire\MasterHargaKontrak;
use App\Livewire\MasterJenisPakan;
use App\Livewire\MasterPemanen;
use App\Livewire\MasterPemodal;
use App\Livewire\Rhpp;
use App\Livewire\SamplingBobot;
use App\Models\Kandang;
use App\Models\Periode;
use Database\Seeders\DatabaseSeeder;
use DOMDocument;
use DOMElement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Tombol simpan di dalam modal harus berada di dalam form-nya. Bila tidak, klik tombol hanya
 * mengisi ulang halaman tanpa menyimpan apa pun, karena peristiwa submit tidak pernah sampai
 * ke Livewire.
 */
class ModalFormTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_every_submit_button_sits_inside_a_form(): void
    {
        $periode = Periode::query()->where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = $periode->kandangPeriode()->firstOrFail();

        $halaman = [
            'periode' => Livewire::withQueryParams(['periode' => $periode->id])->test(ManajemenPeriode::class)->html(),
            'rhpp' => Livewire::withQueryParams(['periode' => $periode->id, 'tab' => 'real'])->test(Rhpp::class)->html(),
            'kas-operasional' => Livewire::withQueryParams(['periode' => $periode->id])->test(KasOperasional::class, ['kandang' => $kandang])->html(),
            'pakan' => Livewire::withQueryParams(['periode' => $periode->id])->test(LogPemberianPakan::class)->html(),
            'harga-doc' => Livewire::test(MasterHargaDoc::class)->html(),
            'harga-kontrak' => Livewire::test(MasterHargaKontrak::class)->html(),
            'jenis-pakan' => Livewire::test(MasterJenisPakan::class)->html(),
            'pemanen' => Livewire::test(MasterPemanen::class)->html(),
            'pemodal' => Livewire::test(MasterPemodal::class)->html(),
            'sampling' => Livewire::withQueryParams(['periode' => $periode->id])->test(SamplingBobot::class, ['kandang' => $kandang->id, 'periodeKandang' => $periodeKandang->id])->html(),
            'laporan-harian' => Livewire::withQueryParams(['periode' => $periode->id])->test(FormLaporanHarian::class, ['kandang' => $kandang->id])->html(),
        ];

        foreach ($halaman as $nama => $html) {
            foreach ($this->tombolSubmit($html) as $tombol) {
                $this->assertTrue(
                    $this->dalamForm($tombol),
                    'Tombol submit pada halaman '.$nama.' berada di luar form, sehingga kliknya tidak menyimpan apa pun.',
                );
            }
        }
    }

    /**
     * @return list<DOMElement>
     */
    private function tombolSubmit(string $html): array
    {
        $dom = new DOMDocument;
        @$dom->loadHTML($html);
        $tombol = [];

        foreach ($dom->getElementsByTagName('button') as $satu) {
            if ($satu instanceof DOMElement && $satu->getAttribute('type') === 'submit') {
                $tombol[] = $satu;
            }
        }

        return $tombol;
    }

    private function dalamForm(DOMElement $tombol): bool
    {
        $induk = $tombol->parentNode;

        while ($induk !== null) {
            if ($induk instanceof DOMElement && strtolower($induk->nodeName) === 'form') {
                return true;
            }

            $induk = $induk->parentNode;
        }

        return false;
    }
}
