<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom foreign key yang belum menjadi kolom pertama index mana pun. SQLite tidak membuat index untuk
     * foreign key, sehingga tanpa index ini setiap join, cascade, dan pemeriksaan restrict memindai seluruh tabel.
     *
     * @var array<string, list<string>>
     */
    private const KOLOM = [
        'kandang_pemodal' => ['pemodal_id'],
        'karyawan_project' => ['karyawan_id'],
        'karyawans' => ['kandang_id'],
        'kasbons' => ['karyawan_id', 'periode_id'],
        'kohe_penjualans' => ['farm_id'],
        'kohe_stoks' => ['farm_id', 'kandang_id'],
        'nota_panen_pemanens' => ['nota_panen_id'],
        'pembayaran_pemanens' => ['pemanen_id'],
        'pemberian_pakans' => ['jenis_pakan_id'],
        'penerimaan_pakans' => ['periode_id', 'jenis_pakan_id'],
        'periode_kandangs' => ['kandang_id'],
        'potongan_kasbons' => ['slip_gaji_id'],
        'project_tasks' => ['karyawan_id'],
        'slip_gajis' => ['penerima_bagi_hasil_id', 'karyawan_id'],
        'transfer_pakans' => ['periode_kandang_id', 'jenis_pakan_id'],
    ];

    public function up(): void
    {
        foreach (self::KOLOM as $tabel => $kolom) {
            Schema::table($tabel, function (Blueprint $table) use ($kolom) {
                foreach ($kolom as $satu) {
                    $table->index($satu);
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (self::KOLOM as $tabel => $kolom) {
            Schema::table($tabel, function (Blueprint $table) use ($kolom) {
                foreach ($kolom as $satu) {
                    $table->dropIndex([$satu]);
                }
            });
        }
    }
};
