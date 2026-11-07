<?php

namespace Tests\Feature;

use App\Support\HasilSampling;
use App\Support\Standar;
use App\Support\SusunanSampling;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SusunanSamplingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_kandang_satu_punya_lima_line_per_lantai_dan_lainnya_memakai_bawaan(): void
    {
        $this->assertSame(['A', 'B', 'C', 'D', 'E'], SusunanSampling::untuk('Kandang 1')['bawah']['line']);
        $this->assertSame(['F', 'G', 'H', 'I', 'J'], SusunanSampling::untuk('Kandang 1')['atas']['line']);
        $this->assertSame(config('sampling.lantai'), SusunanSampling::untuk('Kandang 2'));
        $this->assertSame(config('sampling.lantai'), SusunanSampling::untuk(null));
    }

    public function test_hasil_dihitung_dari_susunan_kandang_satu(): void
    {
        $susunan = SusunanSampling::untuk('Kandang 1');
        $berat = [];
        $ekor = [];
        foreach ($susunan as $lantai => $info) {
            foreach ($info['line'] as $line) {
                foreach ([1, 2] as $urutan) {
                    $berat[$lantai]['campuran'][$line][$urutan] = 1500;
                    $ekor[$lantai]['campuran'][$line][$urutan] = 20;
                }
            }
        }

        $hasil = HasilSampling::hitung($berat, $ekor, false, 9, new Standar('Standar farm', 37.0), null, [], 1, 1, $susunan);

        $this->assertSame(10, $hasil['gabungan']['jumlah_line']);
        $this->assertSame(20, $hasil['gabungan']['jumlah_titik_penuh']);
        $this->assertSame(20, $hasil['gabungan']['jumlah_titik']);
        $this->assertEqualsWithDelta(75.0, $hasil['gabungan']['abw'], 0.001);
    }
}
