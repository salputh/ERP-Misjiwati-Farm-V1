<?php

namespace App\Support;

use App\Models\Periode;
use Illuminate\Support\Str;

/**
 * Laporan harian satu tanggal sebagai teks siap tampil: bahan kartu di modal dan gambar PNG
 * yang dilukis di peramban (resources/js/gambar-laporan.js). Angkanya dari RingkasanHarian::buat().
 */
class LembarLaporanHarian
{
    /**
     * @param  array<string, mixed>  $laporan  hasil RingkasanHarian::buat()
     * @return array{
     *     berkas: string,
     *     tanggal: string,
     *     judul: string,
     *     info: list<array{label: string, nilai: string}>,
     *     utama: list<array{label: string, nilai: string, catatan: string, selisih: ?array{teks: string, naik: bool}}>,
     *     pakan_masuk: array{baris: list<array{tanggal: string, jenis: string, zak: string}>, total: string},
     *     opname: array{baris: list<array<string, mixed>>, total: array<string, mixed>, catatan: ?string},
     *     kandang: array{baris: list<array<string, mixed>>, total: ?array<string, string>},
     *     catatan: list<string>,
     *     keterangan: string
     * }
     */
    public static function buat(Periode $periode, array $laporan): array
    {
        $total = $laporan['total'];
        $satuKandang = count($laporan['kandang']) === 1 ? $laporan['kandang'][0] : null;

        return [
            'berkas' => 'laporan-harian-'.Str::slug($periode->nama).'-'.$laporan['tanggal']->format('Y-m-d'),
            'tanggal' => $laporan['tanggal']->format('Y-m-d'),
            'judul' => $laporan['tanggal']->translatedFormat('j F Y'),
            'info' => [
                ['label' => 'Peternak', 'nilai' => 'Misjiwati'],
                ['label' => 'Periode', 'nilai' => $periode->nama],
                ['label' => 'Kandang', 'nilai' => collect($laporan['kandang'])->pluck('nama')->join(', ')],
                ['label' => 'Jumlah ayam', 'nilai' => Format::angka($laporan['populasi']).' ekor'],
                ['label' => 'Tanggal laporan', 'nilai' => $laporan['tanggal']->translatedFormat('l, j F Y')],
                ['label' => 'Usia', 'nilai' => $laporan['umur'].' hari'],
            ],
            'utama' => [
                self::angkaUtama('Sisa ayam di kandang', Format::angka($total['sisa']), 'dari '.Format::angka($total['populasi']).' ekor chick-in'),
                self::angkaUtama('Kematian hari ini', Format::angka($total['mati_hari_ini']), 'kumulatif '.Format::angka($total['mati_kumulatif']).' ekor ('.Format::angka($total['mortalitas'], 2).'%)'),
                isset($satuKandang['abw_selisih'])
                    ? self::angkaUtama('ABW', self::gram($total['abw']), 'dari standar '.Format::angka($satuKandang['abw_standar']).' g', self::selisih($satuKandang['abw_selisih']))
                    : self::angkaUtama('ABW', self::gram($total['abw']), 'rata-rata tertimbang jumlah ayam'),
                self::angkaUtama('FCR', Format::angka($total['fcr'], 3), isset($satuKandang['fcr_standar']) ? 'standar '.Format::angka($satuKandang['fcr_standar'], 3) : 'pakan per ekor dibagi ABW'),
            ],
            'pakan_masuk' => [
                'baris' => array_map(fn (array $masuk): array => [
                    'tanggal' => $masuk['tanggal']->translatedFormat('j F Y'),
                    'jenis' => $masuk['jenis'],
                    'zak' => Format::angka($masuk['zak']),
                ], $laporan['pakan_masuk']),
                'total' => Format::angka($laporan['total_pakan_masuk']).' zak',
            ],
            'opname' => [
                'baris' => array_map(fn (array $stok): array => [
                    'jenis' => $stok['jenis'],
                    'masuk' => Format::angka($stok['masuk']),
                    'terpakai_hari_ini' => Format::angka($stok['terpakai_hari_ini']),
                    'terpakai' => Format::angka($stok['terpakai']),
                    'sisa' => isset($stok['sisa']) ? Format::kurung($stok['sisa']) : '-',
                    'sisa_kurang' => $stok['sisa'] < 0,
                ], $laporan['opname']),
                'total' => [
                    'masuk' => Format::angka($laporan['total_opname']['masuk']),
                    'terpakai_hari_ini' => Format::angka($laporan['total_opname']['terpakai_hari_ini']),
                    'terpakai' => Format::angka($laporan['total_opname']['terpakai']),
                    'sisa' => isset($laporan['total_opname']['sisa']) ? Format::kurung($laporan['total_opname']['sisa']) : '-',
                    'sisa_kurang' => $laporan['total_opname']['sisa'] < 0,
                ],
                'catatan' => isset($laporan['hari_cukup']) ? 'Sisa stok cukup sekitar '.Format::angka($laporan['hari_cukup'], 1).' hari dengan pemakaian hari ini' : null,
            ],
            'kandang' => [
                'baris' => array_map(fn (array $kandang): array => [
                    'nama' => $kandang['nama'],
                    'populasi' => Format::angka($kandang['populasi']).' ekor chick-in',
                    'mati_hari_ini' => Format::angka($kandang['mati_hari_ini']),
                    'mati_kumulatif' => Format::angka($kandang['mati_kumulatif']),
                    'mortalitas' => Format::angka($kandang['mortalitas'], 2).'%',
                    'sisa' => Format::angka($kandang['sisa']),
                    'abw' => self::gram($kandang['abw']),
                    'abw_selisih' => isset($kandang['abw']) ? self::selisih($kandang['abw_selisih']) : null,
                    'fcr' => Format::angka($kandang['fcr'], 3),
                    'fcr_standar' => isset($kandang['fcr_standar']) ? 'standar '.Format::angka($kandang['fcr_standar'], 3) : null,
                ], $laporan['kandang']),
                'total' => $satuKandang ? null : [
                    'mati_hari_ini' => Format::angka($total['mati_hari_ini']),
                    'mati_kumulatif' => Format::angka($total['mati_kumulatif']).' ('.Format::angka($total['mortalitas'], 2).'%)',
                    'sisa' => Format::angka($total['sisa']),
                    'abw' => self::gram($total['abw']),
                    'fcr' => Format::angka($total['fcr'], 3),
                ],
            ],
            'catatan' => array_map(
                fn (array $catatan): string => $catatan['kandang'].', '.$catatan['tanggal']->translatedFormat('j F Y').': '.$catatan['catatan'],
                $laporan['catatan'],
            ),
            'keterangan' => 'Satu zak = '.Format::angka(config('standar.kg_per_zak')).' kg. FCR: pakan kumulatif per ekor dibagi ABW timbang terakhir.',
        ];
    }

    /**
     * @param  ?array{teks: string, naik: bool}  $selisih
     * @return array{label: string, nilai: string, catatan: string, selisih: ?array{teks: string, naik: bool}}
     */
    private static function angkaUtama(string $label, string $nilai, string $catatan, ?array $selisih = null): array
    {
        return ['label' => $label, 'nilai' => $nilai, 'catatan' => $catatan, 'selisih' => $selisih];
    }

    private static function gram(?float $nilai): string
    {
        return $nilai === null ? '-' : Format::angka($nilai).' g';
    }

    /**
     * Selisih persen terhadap standar: besarnya dan arahnya.
     *
     * @return ?array{teks: string, naik: bool}
     */
    private static function selisih(?float $persen): ?array
    {
        return $persen === null ? null : ['teks' => Format::angka(abs($persen), 1).'%', 'naik' => $persen >= 0];
    }
}
