<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class RecordingHarianExport implements FromArray, WithHeadings, WithStyles
{
    /**
     * @param  list<array<string, mixed>>  $baris
     */
    public function __construct(private readonly array $baris) {}

    /**
     * @return list<array{key: string, heading: string, decimals: int, suffix: string, date?: bool}>
     */
    public static function kolom(): array
    {
        return [
            ['key' => 'tanggal', 'heading' => 'Tanggal', 'decimals' => 0, 'suffix' => '', 'date' => true],
            ['key' => 'umur', 'heading' => 'Umur (hari)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'mati', 'heading' => 'Deplesi - Mati (ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'afkir', 'heading' => 'Deplesi - Afkir (ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'deplesi_kumulatif', 'heading' => 'Deplesi - Jumlah kumulatif (ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'deplesi_persen', 'heading' => 'Deplesi - Kumulatif (%)', 'decimals' => 1, 'suffix' => '%'],
            ['key' => 'deplesi_persen_standar', 'heading' => 'Deplesi - Standar kumulatif (%)', 'decimals' => 2, 'suffix' => '%'],
            ['key' => 'deplesi_ekor_standar', 'heading' => 'Deplesi - Standar kumulatif (ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'zak_standar', 'heading' => 'Pakan standar - Zak', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'zak_standar_kumulatif', 'heading' => 'Pakan standar - Kumulatif (zak)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'pakan_gram_standar', 'heading' => 'Pakan standar - Gram/ekor', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'pakan_gram_standar_kumulatif', 'heading' => 'Pakan standar - Kumulatif (gram/ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'zak', 'heading' => 'Pakan aktual - Zak', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'zak_kumulatif', 'heading' => 'Pakan aktual - Kumulatif (zak)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'pakan_gram', 'heading' => 'Pakan aktual - Gram/ekor', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'pakan_gram_kumulatif', 'heading' => 'Pakan aktual - Kumulatif (gram/ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'selisih_zak', 'heading' => 'Pakan - Selisih (zak)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'selisih_pakan_gram', 'heading' => 'Pakan - Selisih (gram/ekor)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'abw_standar', 'heading' => 'Body weight standar - ABW (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'dg_standar', 'heading' => 'Body weight standar - DG (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'abw', 'heading' => 'Body weight aktual - ABW (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'dg', 'heading' => 'Body weight aktual - DG (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'dg_kumulatif', 'heading' => 'Body weight aktual - DG kumulatif (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'abw_persen_standar', 'heading' => 'Body weight aktual - ABW standar (%)', 'decimals' => 0, 'suffix' => '%'],
            ['key' => 'selisih_abw', 'heading' => 'Body weight - Selisih ABW (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'selisih_dg', 'heading' => 'Body weight - Selisih DG (gram)', 'decimals' => 0, 'suffix' => ''],
            ['key' => 'persen_pakan_bw_standar', 'heading' => 'Pakan vs BW - Standar (%)', 'decimals' => 0, 'suffix' => '%'],
            ['key' => 'persen_pakan_bw', 'heading' => 'Pakan vs BW - Aktual (%)', 'decimals' => 0, 'suffix' => '%'],
            ['key' => 'fcr_standar', 'heading' => 'FCR - Standar', 'decimals' => 3, 'suffix' => ''],
            ['key' => 'fcr', 'heading' => 'FCR - Aktual', 'decimals' => 3, 'suffix' => ''],
            ['key' => 'selisih_fcr', 'heading' => 'FCR - Selisih', 'decimals' => 3, 'suffix' => ''],
            ['key' => 'saldo', 'heading' => 'Saldo ayam (ekor)', 'decimals' => 0, 'suffix' => ''],
        ];
    }

    public function array(): array
    {
        return array_map(
            fn (array $hari): array => array_map(
                fn (array $kolom): mixed => isset($kolom['date'])
                    ? $hari[$kolom['key']]->toDateString()
                    : ($hari[$kolom['key']] ?? null),
                self::kolom(),
            ),
            $this->baris,
        );
    }

    public function headings(): array
    {
        return array_column(self::kolom(), 'heading');
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => 'solid',
                    'startColor' => ['rgb' => '8231D3'],
                ],
            ],
        ];
    }
}
