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
        Schema::create('harga_kontraks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->constrained()->cascadeOnDelete();
            // Batas bawah bracket ABW; berlaku sampai batas bawah bracket berikutnya.
            $table->decimal('bobot_min_kg', 4, 2);
            $table->unsignedInteger('harga_per_kg');
            $table->timestamps();
            $table->unique(['periode_id', 'bobot_min_kg']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('harga_kontraks');
    }
};
