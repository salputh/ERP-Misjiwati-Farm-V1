<?php

namespace App\Models;

use Database\Factories\RhppRealFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Angka dari dokumen RHPP yang diterbitkan inti: sapronak, kinerja, tarif efisiensi, dan subsidi harga pasar.
 */
class RhppReal extends Model
{
    /** @use HasFactory<RhppRealFactory> */
    use HasFactory;

    /**
     * Dokumen masih boleh diubah.
     */
    public const SEMENTARA = 'sementara';

    /**
     * Dokumen dikunci: tidak dapat diubah sampai dibuka kembali dengan password admin.
     */
    public const DIKUNCI = 'dikunci';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tanggal_proses' => 'date',
            'doc_ekor' => 'integer',
            'doc_diklaim_ekor' => 'integer',
            'pakan_kg' => 'float',
            'ovk_jumlah' => 'float',
            'fcr_aktual' => 'float',
            'fcr_standar' => 'float',
            'deplesi_persen' => 'float',
            'deplesi_standar_persen' => 'float',
            'umur_rata' => 'float',
        ];
    }

    public function periode(): BelongsTo
    {
        return $this->belongsTo(Periode::class);
    }

    /**
     * Apakah dokumen ini dikunci sehingga tidak dapat diubah.
     */
    public function terkunci(): bool
    {
        return $this->status === self::DIKUNCI;
    }
}
