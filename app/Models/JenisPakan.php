<?php

namespace App\Models;

use Database\Factories\JenisPakanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JenisPakan extends Model
{
    /** @use HasFactory<JenisPakanFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['harga_per_kg' => 'integer', 'kg_per_zak' => 'float'];
    }

    public function penerimaanPakan(): HasMany
    {
        return $this->hasMany(PenerimaanPakan::class);
    }

    public function pemberianPakan(): HasMany
    {
        return $this->hasMany(PemberianPakan::class);
    }
}
