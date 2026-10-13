<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Kandang extends Model
{
    protected $guarded = [];

    public function pemodal(): BelongsToMany
    {
        return $this->belongsToMany(Pemodal::class)
            ->withPivot('persen')
            ->withTimestamps()
            ->orderBy('kandang_pemodal.id');
    }
}
