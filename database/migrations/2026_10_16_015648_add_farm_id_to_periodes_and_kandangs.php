<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $farmId = DB::table('farms')->insertGetId([
            'nama' => 'Misjiwati Farm',
            'kode' => 'K0242',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        Schema::table('periodes', function (Blueprint $table) use ($farmId): void {
            $table->foreignId('farm_id')->default($farmId)->constrained()->restrictOnDelete();
            $table->unique(['farm_id', 'nama']);
        });

        Schema::table('kandangs', function (Blueprint $table) use ($farmId): void {
            $table->foreignId('farm_id')->default($farmId)->constrained()->restrictOnDelete();
            $table->unique(['farm_id', 'nama']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kandangs', function (Blueprint $table): void {
            $table->dropUnique('kandangs_farm_id_nama_unique');
            $table->dropConstrainedForeignId('farm_id');
        });

        Schema::table('periodes', function (Blueprint $table): void {
            $table->dropUnique('periodes_farm_id_nama_unique');
            $table->dropConstrainedForeignId('farm_id');
        });
    }
};
