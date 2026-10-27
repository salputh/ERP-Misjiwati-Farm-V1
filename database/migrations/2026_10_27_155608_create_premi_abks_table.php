<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('premi_abks', function (Blueprint $table) {
            $table->id();
            // Batas bawah total budidaya per ekor populasi (Rp) agar baris ini berlaku.
            $table->unsignedInteger('hasil_per_ekor')->unique();
            $table->unsignedInteger('intensif');
            // Premi pemeliharaan ABK (Rp) untuk satu kandang koloni dengan 4 ABK.
            $table->unsignedBigInteger('premi');
            $table->timestamps();
        });

        // Tabel "Estimasi hasil kandang koloni per ekor (4 abk)".
        $baris = [
            [5_500, 50, 1_050_000],
            [6_000, 75, 1_500_000],
            [6_500, 100, 2_050_000],
            [7_000, 125, 2_500_000],
            [7_500, 150, 2_900_000],
            [8_000, 175, 3_300_000],
            [8_500, 200, 3_700_000],
            [9_000, 225, 4_200_000],
        ];

        DB::table('premi_abks')->insert(array_map(fn (array $satu): array => [
            'hasil_per_ekor' => $satu[0],
            'intensif' => $satu[1],
            'premi' => $satu[2],
            'created_at' => now(),
            'updated_at' => now(),
        ], $baris));
    }

    public function down(): void
    {
        Schema::dropIfExists('premi_abks');
    }
};
