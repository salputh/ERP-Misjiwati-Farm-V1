<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HargaDoc extends Model
{
    public const GLOBAL_ID = 1;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'harga_per_ekor' => 'integer',
            'jumlah_ekor' => 'integer',
        ];
    }
}
