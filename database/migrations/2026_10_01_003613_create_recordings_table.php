<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_kandang_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->unsignedSmallInteger('umur');
            $table->unsignedInteger('mati')->default(0);
            $table->unsignedInteger('afkir')->default(0);
            $table->decimal('bobot_rata_gram', 7, 1)->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->unique(['periode_kandang_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recordings');
    }
};
