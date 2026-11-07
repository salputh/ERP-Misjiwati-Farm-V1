<?php

namespace App\Support;

/**
 * Susunan lantai dan line sampling bobot. Kandang yang tidak punya susunan khusus memakai susunan bawaan.
 */
class SusunanSampling
{
    /**
     * @return array<string, array{label: string, line: list<string>}>
     */
    public static function untuk(?string $namaKandang): array
    {
        return config("sampling.susunan_kandang.{$namaKandang}") ?? config('sampling.lantai');
    }
}
