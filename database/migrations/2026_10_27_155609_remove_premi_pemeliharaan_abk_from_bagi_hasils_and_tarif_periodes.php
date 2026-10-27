<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Premi pemeliharaan ABK tidak lagi diketik: nilainya diambil dari tabel premi_abks menurut total budidaya per ekor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bagi_hasils', function (Blueprint $table) {
            $table->dropColumn('premi_pemeliharaan_abk');
        });

        Schema::table('tarif_periodes', function (Blueprint $table) {
            $table->dropColumn('premi_pemeliharaan_abk');
        });
    }

    public function down(): void
    {
        Schema::table('bagi_hasils', function (Blueprint $table) {
            $table->unsignedBigInteger('premi_pemeliharaan_abk')->default(0);
        });

        Schema::table('tarif_periodes', function (Blueprint $table) {
            $table->unsignedBigInteger('premi_pemeliharaan_abk')->default(0);
        });
    }
};
