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
        Schema::table('periodes', function (Blueprint $table): void {
            $table->unsignedSmallInteger('nomor_siklus')->nullable()->after('nama');
            $table->string('inti')->nullable()->after('nomor_siklus');
            $table->string('ppl')->nullable()->after('inti');
            $table->unique(['farm_id', 'nomor_siklus']);
            $table->string('status')->default('persiapan')->change();
        });

        Schema::table('periode_kandangs', function (Blueprint $table): void {
            $table->date('tanggal_chick_in')->nullable()->after('populasi_awal');
            $table->unsignedSmallInteger('berat_doc_gram')->nullable()->after('tanggal_chick_in');
            $table->unsignedInteger('harga_doc_per_ekor')->nullable()->after('berat_doc_gram');
            $table->unsignedInteger('bonus_doc_ekor')->default(0)->after('harga_doc_per_ekor');
        });

        DB::table('periodes')->where('status', 'aktif')->update(['status' => 'berjalan']);
        DB::table('periodes')->where('status', 'selesai')->update(['status' => 'tutup_rhpp']);

        DB::table('periode_kandangs')
            ->join('periodes', 'periodes.id', '=', 'periode_kandangs.periode_id')
            ->select([
                'periode_kandangs.id',
                'periodes.tanggal_chick_in',
                'periodes.berat_doc_gram',
            ])
            ->orderBy('periode_kandangs.id')
            ->get()
            ->each(fn (object $data) => DB::table('periode_kandangs')
                ->where('id', $data->id)
                ->update([
                    'tanggal_chick_in' => $data->tanggal_chick_in,
                    'berat_doc_gram' => $data->berat_doc_gram,
                ]));

        $hargaDoc = DB::table('harga_docs')->orderBy('id')->value('harga_per_ekor');
        if ($hargaDoc !== null) {
            DB::table('periode_kandangs')->update(['harga_doc_per_ekor' => $hargaDoc]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('periodes')->where('status', 'berjalan')->update(['status' => 'aktif']);
        DB::table('periodes')->where('status', 'tutup_rhpp')->update(['status' => 'selesai']);

        Schema::table('periode_kandangs', function (Blueprint $table): void {
            $table->dropColumn([
                'tanggal_chick_in',
                'berat_doc_gram',
                'harga_doc_per_ekor',
                'bonus_doc_ekor',
            ]);
        });

        Schema::table('periodes', function (Blueprint $table): void {
            $table->dropUnique('periodes_farm_id_nomor_siklus_unique');
            $table->dropColumn(['nomor_siklus', 'inti', 'ppl']);
            $table->string('status')->default('aktif')->change();
        });
    }
};
