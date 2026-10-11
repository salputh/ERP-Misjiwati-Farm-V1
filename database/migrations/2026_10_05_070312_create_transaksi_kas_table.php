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
        Schema::create('transaksi_kas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_kandang_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('kategori');
            $table->string('uraian');
            // Rupiah, selalu positif. Arah uang (masuk atau keluar) ditentukan kategorinya.
            $table->unsignedBigInteger('jumlah');
            $table->timestamps();
            $table->index(['periode_kandang_id', 'tanggal']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaksi_kas');
    }
};
