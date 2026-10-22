<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('harga_docs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('harga_per_ekor');
            $table->unsignedInteger('jumlah_ekor');
            $table->timestamps();
        });

        DB::table('harga_docs')->insert([
            'id' => 1,
            'harga_per_ekor' => 9415,
            'jumlah_ekor' => 26000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('harga_docs');
    }
};
