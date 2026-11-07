<?php

namespace App\Models;

use App\Livewire\Projects;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tanggal_mulai' => 'date',
            'tanggal_selesai' => 'date',
        ];
    }

    /**
     * Project melewati target selesai padahal belum selesai atau ditunda.
     */
    public function terlambat(): bool
    {
        return (bool) $this->tanggal_selesai?->lt(today()) && ! in_array($this->status, ['completed', 'on_hold'], true);
    }

    /**
     * Label status untuk tampilan; project yang lewat target ditandai terlambat.
     */
    public function labelStatus(): string
    {
        return $this->terlambat() ? 'Terlambat' : (Projects::STATUS[$this->status] ?? (string) $this->status);
    }

    /**
     * Warna lencana status mengikuti media-badge template project: danger, success, warning, atau primary.
     */
    public function warnaStatus(): string
    {
        return match (true) {
            $this->terlambat() => 'danger',
            $this->status === 'completed' => 'success',
            $this->status === 'on_hold' => 'warning',
            default => 'primary',
        };
    }

    /**
     * Modifier kartu project (project-kartu--*): media-ui--late, --completed, --onHold, atau --early.
     */
    public function modifierKartu(): string
    {
        return match (true) {
            $this->terlambat() => 'late',
            $this->status === 'completed' => 'completed',
            $this->status === 'on_hold' => 'onHold',
            default => 'early',
        };
    }

    /**
     * Persentase tugas selesai dari hitungan withCount (tugas_count dan tugas_selesai_count) atau dari relasi tugas.
     */
    public function progres(): int
    {
        $jumlah = $this->tugas_count ?? $this->tugas->count();
        $selesai = $this->tugas_selesai_count ?? $this->tugas->where('status', 'completed')->count();

        return $jumlah > 0 ? (int) round($selesai / $jumlah * 100) : 0;
    }

    public function anggota(): BelongsToMany
    {
        return $this->belongsToMany(Karyawan::class)->withTimestamps();
    }

    public function tugas(): HasMany
    {
        return $this->hasMany(ProjectTask::class);
    }
}
