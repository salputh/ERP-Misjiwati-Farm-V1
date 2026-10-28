<?php

namespace App\Enums;

use Illuminate\Support\Arr;

/**
 * Halaman tempat aksi dilakukan. Nilainya slug item di config/navigasi.php, sumber label dan ikonnya.
 */
enum ModulAktivitas: string
{
    case Farm = 'farm';
    case Periode = 'periode';
    case LaporanHarian = 'laporan-harian';
    case PakanDanStok = 'pakan-dan-stok';
    case SamplingBobot = 'sampling-bobot';
    case Panen = 'panen';
    case Kohe = 'kohe';
    case KasOperasional = 'kas-operasional';
    case Rhpp = 'rhpp';
    case BagiHasil = 'bagi-hasil';
    case PayrollAbk = 'payroll-abk';
    case KasbonAbk = 'kasbon-abk';
    case PayrollPemanen = 'payroll-pemanen';
    case Karyawan = 'karyawan';
    case StandarStrain = 'standar-strain';
    case MasterData = 'master-data';
    case Akun = 'akun';

    /**
     * Modul yang dikelola di halaman lain dan tidak punya item sendiri di sidebar.
     * Farm dikelola di halaman Periode, tetapi riwayatnya tetap diberi label Farm.
     *
     * @var array<string, array{ikon: string, label: string, isi: ?string}>
     */
    private const TANPA_MENU = [
        'farm' => ['ikon' => 'uil-building', 'label' => 'Farm', 'isi' => 'Identitas dan konteks farm'],
    ];

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
        return Arr::collapse(Arr::pluck(config('navigasi'), 'item'))[$this->value] ?? self::TANPA_MENU[$this->value];
    }
}
