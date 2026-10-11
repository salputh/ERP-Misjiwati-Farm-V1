<?php

namespace Database\Factories;

use App\Models\TitikSampling;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TitikSampling>
 */
class TitikSamplingFactory extends Factory
{
    /**
     * Sesi diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lantai' => 'bawah',
            'line' => 'A',
            'kelamin' => 'campuran',
            'urutan' => 1,
            'berat_gram' => fake()->numberBetween(1000, 30000),
            'ekor' => 20,
        ];
    }
}
