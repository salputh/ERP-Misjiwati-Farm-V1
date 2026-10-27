<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kasbon ABK (misalnya beli HP atau sepeda motor) yang dibayar lewat beberapa kali potongan slip gaji.
     */
    public function up(): void
    {
        Schema::create('kasbons', function (Blueprint $table) {
            $table->id();
            // Karyawan dengan kasbon tidak boleh dihapus sebelum kasbonnya dihapus.
            $table->foreignId('karyawan_id')->constrained()->restrictOnDelete();
            // Periode saat kasbon diambil; potongan pertama ada di slip periode ini.
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('keperluan', 100);
            $table->unsignedBigInteger('jumlah');
            $table->unsignedTinyInteger('jumlah_potongan');
            // Terisi bila uangnya keluar dari kas operasional kandang: transaksi Pinjaman ABK yang dibuat bersama kasbon ini.
            $table->foreignId('transaksi_kas_id')->nullable()->unique()->constrained('transaksi_kas')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kasbons');
    }
};
