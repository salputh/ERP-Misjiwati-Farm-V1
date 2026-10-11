<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bagi_hasils', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_kandang_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('controller')->nullable();
            // Total pengeluaran operasional kandang, disalin dari lembar bagi hasil (termasuk pinjaman makan dan pinjaman ABK).
            $table->unsignedBigInteger('operasional');
            $table->unsignedInteger('tarif_gaji_abk_per_kg');
            $table->unsignedBigInteger('premi_pemeliharaan_abk')->default(0);
            $table->unsignedBigInteger('premi_controller')->default(0);
            $table->decimal('persen_upah_controller', 5, 2);
            $table->decimal('persen_bonus_pasar_abk', 5, 2);
            $table->decimal('persen_bonus_pasar_controller', 5, 2);
            $table->decimal('persen_zakat', 5, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bagi_hasils');
    }
};
