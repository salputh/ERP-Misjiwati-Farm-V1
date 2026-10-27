<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('standar_strain_harians', function (Blueprint $table) {
            $table->id();
            $table->foreignId('standar_strain_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('umur');
            $table->decimal('abw', 8, 2);
            $table->decimal('pakan_gram', 8, 2);
            $table->decimal('deplesi_persen', 5, 2);
            $table->unique(['standar_strain_id', 'umur']);
        });

        $this->pindahkanStandarBawaan();
    }

    public function down(): void
    {
        Schema::dropIfExists('standar_strain_harians');
    }

    /**
     * Standar yang tadinya dibaca dari config/standar.php menjadi data awal, supaya periode yang sudah memakainya tetap valid.
     */
    private function pindahkanStandarBawaan(): void
    {
        foreach (config('standar.strain', []) as $nama => $tabel) {
            $strainId = DB::table('standar_strains')->insertGetId(['nama' => $nama, 'created_at' => now(), 'updated_at' => now()]);

            foreach ($tabel['abw'] as $umur => $abw) {
                DB::table('standar_strain_harians')->insert([
                    'standar_strain_id' => $strainId,
                    'umur' => $umur,
                    'abw' => $abw,
                    'pakan_gram' => $tabel['pakan_gram'][$umur],
                    'deplesi_persen' => $tabel['deplesi_persen'][$umur],
                ]);
            }
        }
    }
};
