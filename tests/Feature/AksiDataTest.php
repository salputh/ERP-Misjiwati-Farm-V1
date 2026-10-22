<?php

namespace Tests\Feature;

use App\Livewire\SamplingBobot;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\File;
use Livewire\Livewire;
use Symfony\Component\Finder\SplFileInfo;
use Tests\TestCase;

/**
 * Aturan aksi data di seluruh aplikasi: aksi yang mengakses database memakai lapisan memuat berspinner template,
 * dan mengubah atau menghapus data selalu lewat modal konfirmasi.
 */
class AksiDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_loading_overlay_shows_the_template_spinner_for_its_targets(): void
    {
        $html = Blade::render('<x-memuat target="simpan, hapus" teks="Menyimpan laporan harian" />');

        $this->assertStringContainsString('wire:loading.class="lapisan-memuat--tampil"', $html);
        $this->assertStringContainsString('wire:target="simpan, hapus"', $html);
        $this->assertStringContainsString('dm-spin-dots spin-md', $html);
        $this->assertSame(4, substr_count($html, 'spin-dot badge-dot dot-primary'));
        $this->assertStringContainsString('Menyimpan laporan harian', $html);
        $this->assertStringNotContainsString('lapisan-memuat--cepat', $html);

        $this->assertStringContainsString('lapisan-memuat--cepat', Blade::render('<x-memuat target="pilihTab" cepat />'));
    }

    public function test_confirmation_modal_runs_the_action_only_from_its_agree_button(): void
    {
        $html = Blade::render('<x-konfirmasi id="konfirmasi-uji" judul="Hapus data ini?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">Tidak bisa dikembalikan.</x-konfirmasi>');

        $this->assertStringContainsString('class="modal-info-confirmed modal fade" id="konfirmasi-uji"', $html);
        $this->assertStringContainsString('Hapus data ini?', $html);
        $this->assertStringContainsString('Tidak bisa dikembalikan.', $html);
        $this->assertSame(1, substr_count($html, 'wire:click="hapus"'));
        $this->assertMatchesRegularExpression('/class="btn btn-danger btn-sm"\s+data-bs-dismiss="modal"\s+wire:click="hapus"\s+wire:loading.attr="disabled" wire:target="mintaHapus"/', $html);
        $this->assertStringContainsString('data-bs-dismiss="modal">Batal</button>', $html);
        // Selama isi modal disiapkan, spinner menggantikan isinya.
        $this->assertStringContainsString('wire:loading wire:target="mintaHapus"', $html);
        $this->assertStringContainsString('wire:loading.remove wire:target="mintaHapus"', $html);
    }

    /**
     * Aksi hapus tidak boleh dipasang langsung pada tombol atau tautan di halaman; hanya lewat <x-konfirmasi aksi="...">.
     */
    public function test_no_view_triggers_a_delete_action_without_the_confirmation_modal(): void
    {
        $pelanggar = collect(File::allFiles(resource_path('views')))
            ->reject(fn (SplFileInfo $berkas): bool => str_starts_with($berkas->getRelativePathname(), 'template'.DIRECTORY_SEPARATOR))
            ->reject(fn (SplFileInfo $berkas): bool => $berkas->getRelativePathname() === 'components'.DIRECTORY_SEPARATOR.'konfirmasi.blade.php')
            ->filter(fn (SplFileInfo $berkas): bool => preg_match('/wire:(click|submit)[.\w]*="hapus/', $berkas->getContents()) === 1)
            ->map(fn (SplFileInfo $berkas): string => $berkas->getRelativePathname())
            ->values()
            ->all();

        $this->assertSame([], $pelanggar);
    }

    /**
     * Setiap aksi Livewire yang menulis ke database (simpan, hapus) punya lapisan memuat di halamannya.
     */
    public function test_every_page_with_a_write_action_has_a_loading_overlay_for_it(): void
    {
        $tanpaLapisan = [];

        foreach (File::files(app_path('Livewire')) as $berkas) {
            $aksi = array_values(array_filter(['simpan', 'hapus'], fn (string $nama): bool => str_contains($berkas->getContents(), "public function {$nama}(")));
            if ($aksi === []) {
                continue;
            }

            $tampilan = File::get(resource_path('views/livewire/'.str($berkas->getFilenameWithoutExtension())->kebab().'.blade.php'));
            foreach ($aksi as $nama) {
                if (preg_match('/<x-memuat target="[^"]*\b'.$nama.'\b[^"]*"/', $tampilan) !== 1) {
                    $tanpaLapisan[] = $berkas->getFilenameWithoutExtension().'::'.$nama;
                }
            }
        }

        $this->assertSame([], $tanpaLapisan);
    }

    public function test_sampling_asks_for_confirmation_only_when_changing_a_saved_session(): void
    {
        $this->seed(DatabaseSeeder::class);
        $september = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = PeriodeKandang::where(['periode_id' => $september->id, 'kandang_id' => Kandang::where('nama', 'Kandang 2')->firstOrFail()->id])->firstOrFail();

        // 3 Oktober sudah punya sesi tersimpan: tombol simpan membuka modal konfirmasi.
        Livewire::withQueryParams(['periode' => $september->id, 'kandang' => $kandang->id, 'tanggal' => '2026-10-03'])
            ->test(SamplingBobot::class)
            ->assertSeeHtml('wire:key="tombol-simpan-perubahan" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-sampling"')
            ->assertSeeHtml('id="konfirmasi-simpan-sampling"')
            ->assertSee('Simpan perubahan sampling 3 Oktober 2026?')
            ->assertSeeHtml('wire:loading.class="lapisan-memuat--tampil"')
            // Tanggal tanpa sesi: simpan langsung, tanpa konfirmasi.
            ->set('tanggal', '2026-10-01')
            ->assertSeeHtml('wire:key="tombol-simpan-baru" wire:click="simpan"')
            ->assertDontSeeHtml('id="konfirmasi-simpan-sampling"');
    }

    public function test_pages_that_switch_data_show_a_loading_overlay(): void
    {
        $this->seed(DatabaseSeeder::class);
        $juli = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandangDua = Kandang::where('nama', 'Kandang 2')->firstOrFail();

        $halaman = [
            route('recording.harian', ['periode' => $juli->id]) => 'wire:target="pilihKandang"',
            route('rhpp', ['periode' => $juli->id]) => 'wire:target="pilihTab"',
            route('kas.operasional', ['kandang' => $kandangDua, 'periode' => $juli->id]) => 'wire:target="pilihKategori"',
            route('payroll.abk', ['periode' => $juli->id]) => 'wire:target="pilihKandang"',
            route('laporan.harian.form', ['periode' => $juli->id, 'tanggal' => '2026-07-20']) => 'wire:target="tanggal"',
            route('laporan.harian', ['periode' => $juli->id]) => 'wire:target="hapus, hapusTerpilih"',
        ];

        foreach ($halaman as $alamat => $sasaran) {
            $this->get($alamat)
                ->assertOk()
                ->assertSee('lapisan-memuat', false)
                ->assertSee($sasaran, false)
                ->assertSee('dm-spin-dots spin-md', false);
        }
    }
}
