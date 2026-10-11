<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('periode_kandangs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            $table->foreignId('kandang_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('populasi_awal');
            $table->timestamps();

            $table->unique(['periode_id', 'kandang_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('periode_kandangs');
    }
};
