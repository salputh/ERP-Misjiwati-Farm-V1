<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Pemodal extends Model
{
    protected $guarded = [];

    public function kandangs(): BelongsToMany
    {
        return $this->belongsToMany(Kandang::class)
            ->withPivot('persen')
            ->withTimestamps()
            ->orderBy('kandangs.nama');
    }
}
