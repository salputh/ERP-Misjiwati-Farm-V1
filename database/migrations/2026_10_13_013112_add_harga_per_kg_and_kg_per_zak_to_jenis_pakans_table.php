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
        Schema::table('jenis_pakans', function (Blueprint $table) {
            $table->unsignedInteger('harga_per_kg')->nullable()->after('kode');
            $table->decimal('kg_per_zak', 8, 2)->default(50)->after('harga_per_kg');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jenis_pakans', function (Blueprint $table) {
            $table->dropColumn(['harga_per_kg', 'kg_per_zak']);
        });
    }
};
