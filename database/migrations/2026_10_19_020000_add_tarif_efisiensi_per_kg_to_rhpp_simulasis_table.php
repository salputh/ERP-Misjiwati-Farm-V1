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
        Schema::table('rhpp_simulasis', function (Blueprint $table) {
            $table->unsignedInteger('tarif_efisiensi_per_kg')->default(260);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rhpp_simulasis', function (Blueprint $table) {
            $table->dropColumn('tarif_efisiensi_per_kg');
        });
    }
};
