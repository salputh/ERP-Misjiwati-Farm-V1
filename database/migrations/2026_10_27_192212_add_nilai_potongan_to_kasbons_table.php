<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nominal potongan per slip yang disepakati. Kosong berarti kasbon dibagi rata ke jumlah potongannya.
     */
    public function up(): void
    {
        Schema::table('kasbons', function (Blueprint $table) {
            $table->unsignedBigInteger('nilai_potongan')->nullable()->after('jumlah_potongan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kasbons', function (Blueprint $table) {
            $table->dropColumn('nilai_potongan');
        });
    }
};
