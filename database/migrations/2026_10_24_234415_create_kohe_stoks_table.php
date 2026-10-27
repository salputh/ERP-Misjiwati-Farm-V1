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
        // Stok kohe (kotoran hewan) yang masuk gudang farm, dalam karung.
        Schema::create('kohe_stoks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            // Kandang asal kohe; kosong bila tidak dicatat.
            $table->foreignId('kandang_id')->nullable()->constrained()->nullOnDelete();
            $table->date('tanggal');
            $table->unsignedInteger('jumlah_karung');
            $table->string('keterangan')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kohe_stoks');
    }
};
