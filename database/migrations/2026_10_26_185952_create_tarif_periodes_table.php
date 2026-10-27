<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tarif_periodes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('tarif_gaji_abk_per_kg');
            $table->unsignedBigInteger('premi_pemeliharaan_abk')->default(0);
            $table->unsignedBigInteger('premi_controller')->default(0);
            $table->decimal('persen_upah_controller', 5, 2);
            $table->decimal('persen_bonus_pasar_abk', 5, 2);
            $table->decimal('persen_bonus_pasar_controller', 5, 2);
            $table->decimal('persen_zakat', 5, 2);
            $table->timestamps();
        });

        // Satu baris global; nilainya tarif yang selama ini dipakai simulasi bagi hasil.
        DB::table('tarif_periodes')->insert([
            'id' => 1,
            'tarif_gaji_abk_per_kg' => 500,
            'premi_pemeliharaan_abk' => 0,
            'premi_controller' => 0,
            'persen_upah_controller' => 3,
            'persen_bonus_pasar_abk' => 30,
            'persen_bonus_pasar_controller' => 10,
            'persen_zakat' => 2.5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('tarif_periodes');
    }
};
