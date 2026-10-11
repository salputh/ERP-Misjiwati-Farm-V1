<?php

namespace Database\Factories;

use App\Models\JenisPakan;
use App\Models\PemberianPakan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PemberianPakan>
 */
class PemberianPakanFactory extends Factory
{
    /**
     * Kandang periode, tanggal, dan umur diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'jenis_pakan_id' => JenisPakan::factory(),
            'zak' => fake()->numberBetween(5, 60),
        ];
    }
}
