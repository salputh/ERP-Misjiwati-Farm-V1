<?php

namespace Database\Factories;

use App\Models\JenisPakan;
use App\Models\PenerimaanPakan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PenerimaanPakan>
 */
class PenerimaanPakanFactory extends Factory
{
    /**
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'jenis_pakan_id' => JenisPakan::factory(),
            'tanggal' => fake()->dateTimeBetween('-30 days'),
            'zak' => fake()->numberBetween(20, 160),
        ];
    }
}
