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
        Schema::create('nota_panens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            // Tanggal sesi panen dimulai; satu sesi berjalan dari malam sampai pagi berikutnya.
            $table->date('tanggal_panen');
            $table->string('no_spa')->nullable();
            $table->string('no_btpa');
            $table->string('no_polisi');
            $table->string('pembeli');
            $table->dateTime('mulai');
            $table->dateTime('selesai');
            $table->unsignedInteger('jumlah_krat');
            $table->unsignedInteger('ekor');
            $table->decimal('berat_kg', 10, 2);
            $table->decimal('netto_nota_kg', 10, 2);
            $table->timestamps();
            $table->unique(['periode_id', 'no_btpa']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nota_panens');
    }
};
