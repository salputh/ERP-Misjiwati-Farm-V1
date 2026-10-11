<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Angka dari dokumen RHPP yang diterbitkan inti untuk satu periode.
     */
    public function up(): void
    {
        Schema::create('rhpp_reals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status')->default('sementara');
            $table->string('kantor');
            $table->string('no_siklus');
            $table->string('ppl');
            $table->date('tanggal_proses');
            $table->unsignedInteger('doc_ekor');
            $table->unsignedBigInteger('doc_total');
            $table->decimal('pakan_kg', 12, 2);
            $table->unsignedBigInteger('pakan_total');
            $table->decimal('ovk_jumlah', 12, 2);
            $table->string('ovk_satuan');
            $table->unsignedBigInteger('ovk_total');
            $table->decimal('fcr_aktual', 5, 3);
            $table->decimal('fcr_standar', 5, 3);
            $table->decimal('deplesi_persen', 5, 2);
            $table->decimal('deplesi_standar_persen', 5, 2);
            $table->decimal('umur_rata', 5, 2);
            $table->unsignedSmallInteger('ip');
            $table->unsignedInteger('tarif_efisiensi_per_kg');
            $table->unsignedBigInteger('subsidi_harga_pasar');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rhpp_reals');
    }
};
