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
        Schema::table('harga_kontraks', function (Blueprint $table) {
            $table->decimal('bobot_max_kg', 4, 2)->nullable()->after('bobot_min_kg');
        });

        DB::table('harga_kontraks')
            ->orderBy('periode_id')
            ->orderBy('bobot_min_kg')
            ->get()
            ->groupBy('periode_id')
            ->each(function ($bracket): void {
                $urut = $bracket->values();

                foreach ($urut as $indeks => $harga) {
                    $maksimum = isset($urut[$indeks + 1])
                        ? round((float) $urut[$indeks + 1]->bobot_min_kg - 0.01, 2)
                        : 9.99;

                    DB::table('harga_kontraks')
                        ->where('id', $harga->id)
                        ->update(['bobot_max_kg' => $maksimum]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('harga_kontraks', function (Blueprint $table) {
            $table->dropColumn('bobot_max_kg');
        });
    }
};
