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
        Schema::table('karyawans', function (Blueprint $table) {
            // Nilai bawaan slip gaji baru karyawan ini; kosong berarti diisi manual di slip.
            $table->unsignedBigInteger('gaji_pokok')->nullable()->after('keterangan');
            $table->unsignedSmallInteger('hari_kerja')->nullable()->after('gaji_pokok');
            // Tanggal gajian tiap bulan, 1 sampai 31.
            $table->unsignedTinyInteger('tanggal_gajian')->nullable()->after('hari_kerja');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('karyawans', function (Blueprint $table) {
            $table->dropColumn(['gaji_pokok', 'hari_kerja', 'tanggal_gajian']);
        });
    }
};
