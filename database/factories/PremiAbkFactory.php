<?php

namespace Database\Factories;

use App\Models\PremiAbk;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PremiAbk>
 */
class PremiAbkFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'hasil_per_ekor' => fake()->unique()->numberBetween(19, 60) * 500,
            'intensif' => fake()->numberBetween(2, 20) * 25,
            'premi' => fake()->numberBetween(10, 50) * 100_000,
        ];
    }
}
