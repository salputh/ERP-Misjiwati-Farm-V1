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
        ];
    }
}
