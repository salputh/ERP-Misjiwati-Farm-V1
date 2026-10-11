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
        Schema::create('aktivitas', function (Blueprint $table) {
            $table->id();
            // Nilai enum JenisAktivitas (tambah, ubah, hapus) dan ModulAktivitas (halaman asal aksi).
            $table->string('jenis');
            $table->string('modul');
            // Salinan teks saat aksi terjadi, supaya riwayat tetap terbaca setelah datanya diubah atau dihapus.
            $table->string('subjek');
            $table->string('rincian')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('aktivitas');
    }
};
