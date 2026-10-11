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
        Schema::create('sesi_samplings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_kandang_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->unsignedSmallInteger('umur');
            $table->boolean('dengan_sexing')->default(false);
            $table->timestamps();

            $table->unique(['periode_kandang_id', 'tanggal']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sesi_samplings');
    }
};
