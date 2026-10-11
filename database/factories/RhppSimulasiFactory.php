<?php

namespace Database\Factories;

use App\Models\RhppSimulasi;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RhppSimulasi>
 */
class RhppSimulasiFactory extends Factory
{
    /**
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kontrak' => fake()->bothify('P.##'),
            'harga_doc' => fake()->numberBetween(8000, 10000),
            'biaya_pakan' => fake()->numberBetween(500, 1500) * 1_000_000,
            'biaya_ovk' => fake()->numberBetween(1, 5) * 1_000_000,
            'insentif' => 0,
        ];
    }
}
