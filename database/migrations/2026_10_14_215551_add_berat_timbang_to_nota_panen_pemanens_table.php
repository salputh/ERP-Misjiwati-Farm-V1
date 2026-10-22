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
        Schema::table('nota_panen_pemanens', function (Blueprint $table) {
            $table->decimal('berat_timbang_kg', 10, 2)->nullable()->after('krat_mulai');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('nota_panen_pemanens', function (Blueprint $table) {
            $table->dropColumn('berat_timbang_kg');
        });
    }
};
