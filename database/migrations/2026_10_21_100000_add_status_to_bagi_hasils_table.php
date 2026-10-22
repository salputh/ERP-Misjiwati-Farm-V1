<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Status lembar bagi hasil satu kandang: masih dapat diubah, atau dikunci sampai dibuka kembali
     * dengan password admin dari halaman periode.
     */
    public function up(): void
    {
        Schema::table('bagi_hasils', function (Blueprint $table): void {
            $table->string('status')->default('sementara')->after('periode_kandang_id');
        });
    }

    public function down(): void
    {
        Schema::table('bagi_hasils', function (Blueprint $table): void {
            $table->dropColumn('status');
        });
    }
};
