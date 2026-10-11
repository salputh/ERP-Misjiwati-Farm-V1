<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Angka akhir periode yang diisi manual di rekap panen. Bila kosong, dihitung dari recording dan log pakan.
     */
    public function up(): void
    {
        Schema::table('periodes', function (Blueprint $table) {
            $table->decimal('rekap_pakan_zak', 10, 1)->nullable()->after('status');
            $table->unsignedInteger('rekap_deplesi_ekor')->nullable()->after('rekap_pakan_zak');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('periodes', function (Blueprint $table) {
            $table->dropColumn(['rekap_pakan_zak', 'rekap_deplesi_ekor']);
        });
    }
};
