<?php

namespace App\Http\Controllers;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\View\View;

/**
 * Katalog halaman contoh HexaDash di resources/views/template/pages.
 * Hanya untuk pengembangan: melihat markup yang bisa ditiru saat membuat fitur.
 */
class TemplateController extends Controller
{
    public function index(): View
    {
        return view('template.index', [
            'kelompok' => $this->daftarHalaman()->groupBy(fn (string $halaman): string => Str::before($halaman, '/')),
        ]);
    }

    public function show(string $halaman): View
    {
        abort_unless($this->daftarHalaman()->contains($halaman), 404);

        return view('template.pages.'.str_replace('/', '.', $halaman), [
            'title' => Str::headline(basename($halaman)),
            'description' => '',
            'prev_page_url' => $this->urlLangkah($halaman, -1),
            'next_page_url' => $this->urlLangkah($halaman, 1),
        ]);
    }

    /**
     * URL langkah sebelum atau sesudahnya untuk halaman wizard (step_1, step_2, ...).
     */
    private function urlLangkah(string $halaman, int $arah): string
    {
        if (! preg_match('/^(.*step_)(\d+)$/', $halaman, $bagian)) {
            return '#';
        }

        $tujuan = $bagian[1].((int) $bagian[2] + $arah);

        return $this->daftarHalaman()->contains($tujuan) ? route('template.halaman', $tujuan) : '#';
    }

    /**
     * Path tiap halaman contoh relatif terhadap template/pages, tanpa ekstensi.
     *
     * @return Collection<int, string>
     */
    private function daftarHalaman(): Collection
    {
        $akar = resource_path('views/template/pages');

        return collect(File::allFiles($akar))
            ->map(fn ($berkas): string => Str::of($berkas->getPathname())->after($akar.DIRECTORY_SEPARATOR)->before('.blade.php')->replace(DIRECTORY_SEPARATOR, '/')->value())
            ->sort()
            ->values();
    }
}
