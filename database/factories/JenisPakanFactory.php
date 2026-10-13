<?php

namespace Database\Factories;

use App\Models\JenisPakan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JenisPakan>
 */
class JenisPakanFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kode' => 'SB-'.fake()->unique()->numberBetween(10, 99),
            'harga_per_kg' => fake()->numberBetween(7_000, 12_000),
            'kg_per_zak' => 50,
        ];
    }
}
