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
        // Penjualan kohe dari stok farm; total penjualan = jumlah karung × harga per karung.
        Schema::create('kohe_penjualans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('nama_pembeli', 150);
            $table->unsignedInteger('jumlah_karung');
            $table->unsignedBigInteger('harga_per_karung');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kohe_penjualans');
    }
};
