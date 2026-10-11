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
        Schema::create('penerima_bagi_hasils', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bagi_hasil_id')->constrained()->cascadeOnDelete();
            $table->string('peran');
            $table->string('nama');
            $table->string('keterangan')->nullable();
            // Rupiah tetap: premi tetap ABK, bonus pasar perorangan, atau entertain.
            $table->unsignedBigInteger('jumlah')->nullable();
            // Porsi pemodal dalam persen.
            $table->decimal('persen', 6, 3)->nullable();
            // Bonus pasar perorangan yang tercantum di lembar tetapi tidak ikut total pengeluaran.
            $table->boolean('dijumlahkan')->default(true);
            $table->unsignedSmallInteger('urutan')->default(0);
            $table->timestamps();
            $table->index(['bagi_hasil_id', 'peran', 'urutan']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('penerima_bagi_hasils');
    }
};
