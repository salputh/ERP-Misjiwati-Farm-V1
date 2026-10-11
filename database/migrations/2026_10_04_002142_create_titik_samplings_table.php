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
        Schema::create('titik_samplings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sesi_sampling_id')->constrained()->cascadeOnDelete();
            $table->string('lantai');
            $table->string('line', 4);
            $table->string('kelamin');
            $table->unsignedTinyInteger('urutan');
            $table->unsignedInteger('berat_gram');
            $table->unsignedSmallInteger('ekor');
            $table->timestamps();

            $table->unique(['sesi_sampling_id', 'lantai', 'line', 'kelamin', 'urutan']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('titik_samplings');
    }
};
