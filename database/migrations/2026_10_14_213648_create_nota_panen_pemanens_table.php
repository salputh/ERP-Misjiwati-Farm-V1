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
        Schema::create('nota_panen_pemanens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('nota_panen_id')->constrained()->cascadeOnDelete();
            $table->string('nama');
            $table->unsignedInteger('krat_mulai');
            $table->timestamps();
            $table->unique(['nota_panen_id', 'krat_mulai']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nota_panen_pemanens');
    }
};
