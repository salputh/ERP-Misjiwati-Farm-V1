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
        Schema::create('pemodals', function (Blueprint $table) {
            $table->id();
            $table->string('nama')->unique();
            $table->timestamps();
        });

        Schema::create('kandang_pemodal', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kandang_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pemodal_id')->constrained()->cascadeOnDelete();
            $table->decimal('persen', 6, 3);
            $table->timestamps();
            $table->unique(['kandang_id', 'pemodal_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kandang_pemodal');
        Schema::dropIfExists('pemodals');
    }
};
