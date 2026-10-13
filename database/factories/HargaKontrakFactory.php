<?php

namespace Database\Factories;

use App\Models\HargaKontrak;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HargaKontrak>
 */
class HargaKontrakFactory extends Factory
{
    /**
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $bobotMin = fake()->unique()->randomElement([1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1]);

        return [
            'bobot_min_kg' => $bobotMin,
            'bobot_max_kg' => round($bobotMin + 0.09, 2),
            'harga_per_kg' => fake()->numberBetween(21000, 22500),
        ];
    }
}
