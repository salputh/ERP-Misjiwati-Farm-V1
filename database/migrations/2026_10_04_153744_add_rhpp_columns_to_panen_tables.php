<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Harga real per nota dari RHPP, dan rekap panen per kandang untuk alokasi penghasilan.
     */
    public function up(): void
    {
        Schema::table('nota_panens', function (Blueprint $table) {
            $table->unsignedInteger('harga_real_per_kg')->nullable()->after('netto_nota_kg');
        });

        Schema::table('periode_kandangs', function (Blueprint $table) {
            $table->unsignedInteger('panen_trip')->nullable()->after('populasi_awal');
            $table->unsignedInteger('panen_ekor')->nullable()->after('panen_trip');
            $table->decimal('panen_tonase_kg', 10, 2)->nullable()->after('panen_ekor');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('nota_panens', function (Blueprint $table) {
            $table->dropColumn('harga_real_per_kg');
        });

        Schema::table('periode_kandangs', function (Blueprint $table) {
            $table->dropColumn(['panen_trip', 'panen_ekor', 'panen_tonase_kg']);
        });
    }
};
