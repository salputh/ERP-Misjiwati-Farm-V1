<?php

namespace Database\Factories;

use App\Models\Kasbon;
use App\Models\PotonganKasbon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PotonganKasbon>
 */
class PotonganKasbonFactory extends Factory
{
    /**
     * Cicilan Rp 1.000.000. Slip gaji diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kasbon_id' => Kasbon::factory(),
            'jumlah' => 1_000_000,
        ];
    }
}
