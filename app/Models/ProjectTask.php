<?php

namespace App\Models;

use Database\Factories\ProjectTaskFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectTask extends Model
{
    /** @use HasFactory<ProjectTaskFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal_selesai' => 'date'];
    }

    /**
     * Tugas belum selesai yang sudah melewati target selesainya.
     */
    public function terlambat(): bool
    {
        return $this->status !== 'completed' && (bool) $this->tanggal_selesai?->lt(today());
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function karyawan(): BelongsTo
    {
        return $this->belongsTo(Karyawan::class);
    }
}
