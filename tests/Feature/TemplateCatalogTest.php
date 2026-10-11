<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class TemplateCatalogTest extends TestCase
{
    // Sidebar aplikasi membaca daftar kandang dari database untuk dropdown per kandang.
    use RefreshDatabase;

    public function test_catalog_index_lists_template_pages(): void
    {
        $this->get(route('template.index'))
            ->assertOk()
            ->assertSee('Katalog template')
            ->assertSee(route('template.halaman', 'dashboard/demo_one'));
    }

    public function test_unknown_catalog_page_returns_not_found(): void
    {
        $this->get('/template/tidak/ada')->assertNotFound();
        $this->get('/template/../layouts/app')->assertNotFound();
    }

    public function test_every_template_page_renders(): void
    {
        $akar = resource_path('views/template/pages');
        $gagal = [];

        foreach (File::allFiles($akar) as $berkas) {
            $halaman = Str::of($berkas->getPathname())->after($akar.DIRECTORY_SEPARATOR)->before('.blade.php')->replace(DIRECTORY_SEPARATOR, '/')->value();
            $respons = $this->get(route('template.halaman', $halaman));

            if ($respons->status() !== 200) {
                $gagal[] = $halaman.' ['.$respons->status().'] '.Str::limit((string) $respons->exception?->getMessage(), 120);
            }
        }

        $this->assertSame([], $gagal);
    }

    public function test_every_asset_referenced_by_catalog_views_exists(): void
    {
        // Ekstensi gambar ini disambung di view oleh template, jadi path tanpa ekstensi memang bukan berkas.
        $dikecualikan = ['assets/img/furniture', 'assets/img/furniture2', 'assets/img/furniture3'];
        $hilang = [];

        foreach (['pages', 'components'] as $folder) {
            foreach (File::allFiles(resource_path('views/template/'.$folder)) as $berkas) {
                preg_match_all("/asset\\(\\s*'([^']+)'\\s*\\)/", $berkas->getContents(), $cocok);

                foreach (array_diff($cocok[1], $dikecualikan) as $aset) {
                    if (! file_exists(public_path($aset))) {
                        $hilang[$aset] = $folder.'/'.$berkas->getRelativePathname();
                    }
                }
            }
        }

        $this->assertSame([], $hilang);
    }
}
