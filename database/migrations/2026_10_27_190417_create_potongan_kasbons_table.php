<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cicilan kasbon yang dipotong di satu slip gaji. Satu kasbon dipotong paling banyak sekali per slip.
     */
    public function up(): void
    {
        Schema::create('potongan_kasbons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kasbon_id')->constrained()->cascadeOnDelete();
            // Slip dihapus berarti potongannya batal dan sisa kasbon kembali.
            $table->foreignId('slip_gaji_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('jumlah');
            $table->timestamps();
            $table->unique(['kasbon_id', 'slip_gaji_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('potongan_kasbons');
    }
};
