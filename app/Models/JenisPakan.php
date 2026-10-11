<?php

namespace App\Models;

use Database\Factories\JenisPakanFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JenisPakan extends Model
{
    /** @use HasFactory<JenisPakanFactory> */
    use HasFactory;

    protected $guarded = [];
}
