<?php

namespace App\Enums;

use Illuminate\Support\Arr;

/**
 * Halaman tempat aksi dilakukan. Nilainya slug item di config/navigasi.php, sumber label dan ikonnya.
 */
enum ModulAktivitas: string
{
    case LaporanHarian = 'laporan-harian';
    case SamplingBobot = 'sampling-bobot';
    case Panen = 'panen';
    case KasOperasional = 'kas-operasional';

    public function label(): string
    {
        return $this->menu()['label'];
    }

    /**
     * Kelas ikon Unicons modul ini, sama dengan ikon di sidebar.
     */
    public function ikon(): string
    {
        return $this->menu()['ikon'];
    }

    /**
     * @return array{ikon: string, label: string, isi: ?string}
     */
    private function menu(): array
    {
        return Arr::collapse(Arr::pluck(config('navigasi'), 'item'))[$this->value];
    }
}
