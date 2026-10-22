<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Farm extends Model
{
    protected $guarded = [];

    public function periodes(): HasMany
    {
        return $this->hasMany(Periode::class);
    }

    public function kandangs(): HasMany
    {
        return $this->hasMany(Kandang::class);
    }
}
