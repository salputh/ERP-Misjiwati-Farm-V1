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
        Schema::create('transfer_pakans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            $table->foreignId('periode_kandang_id')->constrained()->cascadeOnDelete();
            $table->foreignId('jenis_pakan_id')->constrained();
            $table->date('tanggal');
            $table->decimal('zak', 8, 1);
            $table->timestamps();

            $table->index(['periode_id', 'jenis_pakan_id', 'tanggal']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfer_pakans');
    }
};
