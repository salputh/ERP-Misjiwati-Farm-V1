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

    /**
     * Porsi tetap pemodal pada satu kandang dalam persen, atau null bila tidak punya porsi di kandang itu.
     */
    public function porsiDi(Kandang $kandang): ?float
    {
        $persen = $this->kandangs->firstWhere('id', $kandang->id)?->pivot->persen;

        return $persen === null ? null : (float) $persen;
    }
}
