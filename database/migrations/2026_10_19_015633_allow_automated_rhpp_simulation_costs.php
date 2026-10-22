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
        Schema::table('rhpp_simulasis', function (Blueprint $table) {
            $table->unsignedBigInteger('biaya_pakan')->nullable()->change();
            $table->unsignedBigInteger('biaya_ovk')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('rhpp_simulasis')
            ->whereNull('biaya_pakan')
            ->orWhereNull('biaya_ovk')
            ->update([
                'biaya_pakan' => DB::raw('COALESCE(biaya_pakan, 0)'),
                'biaya_ovk' => DB::raw('COALESCE(biaya_ovk, 0)'),
            ]);

        Schema::table('rhpp_simulasis', function (Blueprint $table) {
            $table->unsignedBigInteger('biaya_pakan')->nullable(false)->change();
            $table->unsignedBigInteger('biaya_ovk')->nullable(false)->change();
        });
    }
};
