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
        Schema::create('slip_gajis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_kandang_id')->constrained()->cascadeOnDelete();
            // ABK yang ikut bagi hasil: pendapatan bagi hasil, bonus pasar, dan premi dihitung dari sana. Kosong untuk joker.
            $table->foreignId('penerima_bagi_hasil_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nama');
            $table->string('jabatan');
            $table->unsignedSmallInteger('hari_kerja');
            // Pendapatan (Rp) yang dicatat per orang.
            $table->unsignedBigInteger('gaji_pokok')->default(0);
            $table->unsignedBigInteger('premi_pemeliharaan')->default(0);
            $table->unsignedBigInteger('premi_panen')->default(0);
            $table->unsignedBigInteger('premi_geomembran')->default(0);
            $table->unsignedBigInteger('penghasilan_kotoran')->default(0);
            // Potongan (Rp).
            $table->unsignedBigInteger('uang_makan')->default(0);
            $table->unsignedBigInteger('pinjaman')->default(0);
            $table->unsignedBigInteger('potongan_lain')->default(0);
            $table->string('keterangan_potongan_lain')->nullable();
            $table->unsignedSmallInteger('urutan')->default(0);
            $table->timestamps();
            $table->unique(['periode_kandang_id', 'nama']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('slip_gajis');
    }
};
