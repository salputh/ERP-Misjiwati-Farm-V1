<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * DOC yang mati di perjalanan dan diklaim kembali ke inti mengurangi populasi DOC
     * yang dipakai menghitung deplesi, IP, dan biaya DOC pada RHPP real.
     */
    public function up(): void
    {
        Schema::table('rhpp_reals', function (Blueprint $table): void {
            $table->unsignedInteger('doc_diklaim_ekor')->default(0)->after('doc_ekor');
        });
    }

    public function down(): void
    {
        Schema::table('rhpp_reals', function (Blueprint $table): void {
            $table->dropColumn('doc_diklaim_ekor');
        });
    }
};
