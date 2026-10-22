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
        Schema::table('nota_panen_pemanens', function (Blueprint $table) {
            $table->dropUnique(['nota_panen_id', 'krat_mulai']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('nota_panen_pemanens', function (Blueprint $table) {
            $table->unique(['nota_panen_id', 'krat_mulai']);
        });
    }
};
