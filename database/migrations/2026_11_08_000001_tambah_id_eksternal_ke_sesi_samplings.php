<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sesi yang dikirim dari sistem lain menyimpan id aslinya di sana, supaya kiriman ulang
     * memperbarui sesi yang sama dan bukan membuat sesi baru.
     */
    public function up(): void
    {
        Schema::table('sesi_samplings', function (Blueprint $table) {
            $table->string('id_eksternal', 64)->nullable()->unique()->after('dengan_sexing');
        });
    }

    public function down(): void
    {
        Schema::table('sesi_samplings', function (Blueprint $table) {
            $table->dropUnique(['id_eksternal']);
            $table->dropColumn('id_eksternal');
        });
    }
};
