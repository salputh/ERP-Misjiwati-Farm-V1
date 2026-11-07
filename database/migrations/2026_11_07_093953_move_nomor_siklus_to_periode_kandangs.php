<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nomor siklus berbeda untuk tiap kandang, jadi dipindah dari periode ke kandang periode.
     * Nilai lama disalin ke semua kandang pada periodenya.
     */
    public function up(): void
    {
        Schema::table('periode_kandangs', function (Blueprint $table): void {
            $table->unsignedSmallInteger('nomor_siklus')->nullable()->after('kandang_id');
        });

        DB::table('periodes')->whereNotNull('nomor_siklus')->orderBy('id')->get(['id', 'nomor_siklus'])
            ->each(fn (object $periode) => DB::table('periode_kandangs')
                ->where('periode_id', $periode->id)
                ->update(['nomor_siklus' => $periode->nomor_siklus]));

        Schema::table('periode_kandangs', function (Blueprint $table): void {
            $table->unique(['kandang_id', 'nomor_siklus']);
        });

        Schema::table('periodes', function (Blueprint $table): void {
            $table->dropUnique('periodes_farm_id_nomor_siklus_unique');
            $table->dropColumn('nomor_siklus');
        });
    }

    public function down(): void
    {
        Schema::table('periodes', function (Blueprint $table): void {
            $table->unsignedSmallInteger('nomor_siklus')->nullable()->after('nama');
        });

        DB::table('periodes')->orderBy('id')->pluck('id')->each(function (int $id): void {
            $nomor = DB::table('periode_kandangs')->where('periode_id', $id)->orderBy('id')->value('nomor_siklus');
            DB::table('periodes')->where('id', $id)->update(['nomor_siklus' => $nomor]);
        });

        Schema::table('periodes', function (Blueprint $table): void {
            $table->unique(['farm_id', 'nomor_siklus']);
        });

        Schema::table('periode_kandangs', function (Blueprint $table): void {
            $table->dropUnique(['kandang_id', 'nomor_siklus']);
            $table->dropColumn('nomor_siklus');
        });
    }
};
