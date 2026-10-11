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
        Schema::table('slip_gajis', function (Blueprint $table) {
            // Karyawan pemilik slip; nama dan jabatan di slip tetap disimpan sebagai catatan saat slip dibuat.
            $table->foreignId('karyawan_id')->nullable()->after('periode_kandang_id')->constrained()->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('slip_gajis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('karyawan_id');
        });
    }
};
