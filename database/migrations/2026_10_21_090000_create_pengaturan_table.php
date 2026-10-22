<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penyimpanan parameter aplikasi yang bisa diubah dari dalam aplikasi, misalnya password admin
     * untuk membuka kunci RHPP. Nilai disimpan dalam bentuk hash, bukan teks polos.
     */
    public function up(): void
    {
        Schema::create('pengaturans', function (Blueprint $table): void {
            $table->id();
            $table->string('kunci')->unique();
            $table->text('nilai')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturans');
    }
};
