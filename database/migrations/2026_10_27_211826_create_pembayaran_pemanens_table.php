<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tanda bahwa upah seorang pemanen di satu periode sudah dibayar, beserta nominal upah saat ditandai.
     */
    public function up(): void
    {
        Schema::create('pembayaran_pemanens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            // Riwayat pembayaran tetap ada walau pemanennya dihapus dari Master Data; namanya disimpan di kolom nama.
            $table->foreignId('pemanen_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nama');
            // Upah (Rp) saat ditandai dibayar; bila upah berubah sesudahnya, halaman menampilkan selisihnya.
            $table->unsignedBigInteger('jumlah');
            $table->timestamp('dibayar_pada');
            $table->timestamps();
            $table->unique(['periode_id', 'pemanen_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pembayaran_pemanens');
    }
};
