<?php

namespace App\Support;

/**
 * Standar pemeliharaan per umur untuk satu strain, dibaca dari config/standar.php.
 */
class Standar
{
    public function __construct(private string $strain, private float $beratDoc) {}

    /**
     * Umur terakhir yang punya standar (hari).
     */
    public function umurMaksimal(): int
    {
        return (int) array_key_last($this->tabel('abw'));
    }

    /**
     * Bobot badan standar (gram). Umur 0 adalah berat DOC.
     */
    public function abw(int $umur): ?float
    {
        return $umur <= 0 ? $this->beratDoc : $this->nilai('abw', $umur);
    }

    /**
     * Konsumsi pakan standar per ekor pada hari itu (gram).
     */
    public function pakanGram(int $umur): ?float
    {
        return $this->nilai('pakan_gram', $umur);
    }

    /**
     * Deplesi kumulatif standar (persen dari populasi awal).
     */
    public function deplesiPersen(int $umur): ?float
    {
        return $this->nilai('deplesi_persen', $umur);
    }

    /**
     * FCR standar kumulatif pada umur tertentu.
     */
    public function fcr(int $umur): ?float
    {
        $abw = $this->abw($umur);
        if ($abw === null || $abw <= 0) {
            return null;
        }

        $pakanKumulatif = 0.0;
        for ($hari = 1; $hari <= $umur; $hari++) {
            $pakan = $this->pakanGram($hari);
            if ($pakan === null) {
                return null;
            }
            $pakanKumulatif += $pakan;
        }

        return $pakanKumulatif / $abw;
    }

    /**
     * @return array<int, int|float>
     */
    private function tabel(string $jenis): array
    {
        return config("standar.strain.{$this->strain}.{$jenis}", []);
    }

    private function nilai(string $jenis, int $umur): ?float
    {
        $nilai = $this->tabel($jenis)[$umur] ?? null;

        return $nilai === null ? null : (float) $nilai;
    }
}
