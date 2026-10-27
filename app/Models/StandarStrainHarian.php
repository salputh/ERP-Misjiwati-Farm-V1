<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StandarStrainHarian extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['umur' => 'integer', 'abw' => 'float', 'pakan_gram' => 'float', 'deplesi_persen' => 'float'];
    }

    public function strain(): BelongsTo
    {
        return $this->belongsTo(StandarStrain::class, 'standar_strain_id');
    }
}
