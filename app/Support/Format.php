<?php

namespace App\Support;

class Format
{
    /**
     * Angka dengan format Indonesia: titik pemisah ribuan, koma desimal.
     */
    public static function angka(int|float|null $nilai, int $desimal = 0): string
    {
        return $nilai === null ? '-' : number_format($nilai, $desimal, ',', '.');
    }

    /**
     * Seperti angka(), tetapi nilai negatif ditulis dalam kurung seperti di lembar recording: (0,067).
     */
    public static function kurung(int|float|null $nilai, int $desimal = 0): string
    {
        if ($nilai === null) {
            return '';
        }

        $teks = number_format(abs($nilai), $desimal, ',', '.');

        return $nilai < 0 ? "({$teks})" : $teks;
    }

    /**
     * Rupiah dalam juta dengan satu desimal, untuk angka besar di kartu ringkasan: Rp 67,3 jt.
     */
    public static function juta(int|float $nilai): string
    {
        return ($nilai < 0 ? '-' : '').'Rp '.number_format(abs($nilai) / 1_000_000, 1, ',', '.').' jt';
    }

    /**
     * Angka dengan desimal seperlunya: 60, 22,5, 1.269. Null dan nol ditulis sebagai tanda hubung.
     */
    public static function ringkas(int|float|null $nilai, int $desimalMaksimal = 1): string
    {
        if (! $nilai) {
            return '-';
        }

        $teks = number_format($nilai, $desimalMaksimal, ',', '.');

        return $desimalMaksimal > 0 ? rtrim(rtrim($teks, '0'), ',') : $teks;
    }

    /**
     * Angka ringkas: nol tetap ditulis "0" supaya tidak terbaca sebagai data kosong,
     * negatif ditulis dalam kurung seperti di lembar recording, dan null jadi tanda hubung.
     */
    public static function ringkasKurung(int|float|null $nilai, int $desimalMaksimal = 1): string
    {
        if ($nilai === null) {
            return '-';
        }

        if ($nilai < 0) {
            return self::kurung($nilai, $desimalMaksimal);
        }

        return $nilai == 0 ? '0' : self::ringkas($nilai, $desimalMaksimal);
    }

    /**
     * Persen tanpa nol di belakang koma: 3%, 2,5%, 79,9%.
     */
    public static function persen(int|float $nilai): string
    {
        return rtrim(rtrim(number_format($nilai, 2, ',', '.'), '0'), ',').'%';
    }

    /**
     * Angka romawi untuk nomor minggu.
     */
    public static function romawi(int $angka): string
    {
        return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][$angka - 1] ?? (string) $angka;
    }
}
