<?php

namespace App\Support;

use App\Models\Periode;

/**
 * Notifikasi di lonceng header: hal di periode terpilih yang perlu ditindaklanjuti. Isinya dihitung dari data
 * saat halaman dibuka, jadi notifikasi hilang sendiri begitu masalahnya diselesaikan.
 */
class Notifikasi
{
    /**
     * @return list<array{judul: string, isi: string, warna: string, ikon: string, tautan: string}>
     */
    public static function untukPeriode(?Periode $periode): array
    {
        if (! $periode) {
            return [];
        }

        return self::payrollPemanen($periode);
    }

    /**
     * Tonase panen yang belum masuk payroll pemanen: nama pemanen belum terdaftar di Master Data, atau berat nota
     * yang belum teralokasi ke nama pemanen.
     *
     * @return list<array{judul: string, isi: string, warna: string, ikon: string, tautan: string}>
     */
    private static function payrollPemanen(Periode $periode): array
    {
        $lembar = LembarPayrollPemanen::buat($periode);
        if (! $lembar) {
            return [];
        }

        $notifikasi = array_map(fn (array $orang): array => [
            'judul' => 'Pemanen '.$orang['nama'].' belum terdaftar',
            'isi' => Format::angka($orang['berat_kg'], 2).' kg panen belum masuk payroll pemanen. Daftarkan namanya di Master Data.',
            'warna' => 'warning',
            'ikon' => 'bi-person-exclamation',
            'tautan' => route('master-data', ['periode' => $periode->id]).'#pemanen',
        ], $lembar['nama_belum_terdaftar']);

        if ($lembar['berat_tanpa_nama'] > 0) {
            $notifikasi[] = [
                'judul' => 'Berat panen belum teralokasi',
                'isi' => Format::angka($lembar['berat_tanpa_nama'], 2).' kg belum punya nama pemanen. Lengkapi nama dan krat mulai di data panen.',
                'warna' => 'warning',
                'ikon' => 'bi-speedometer2',
                'tautan' => route('panen.rekap', ['periode' => $periode->id]),
            ];
        }

        return $notifikasi;
    }
}
