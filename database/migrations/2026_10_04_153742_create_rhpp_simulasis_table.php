<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Input manual simulasi RHPP satu periode (sel kuning di lembar simulasi).
     */
    public function up(): void
    {
        Schema::create('rhpp_simulasis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periode_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('kontrak')->nullable();
            $table->unsignedInteger('harga_doc');
            $table->unsignedBigInteger('biaya_pakan');
            $table->unsignedBigInteger('biaya_ovk')->default(0);
            $table->unsignedBigInteger('insentif')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rhpp_simulasis');
    }
};
