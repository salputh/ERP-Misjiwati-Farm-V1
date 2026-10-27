<?php

namespace Database\Factories;

use App\Models\KohePenjualan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<KohePenjualan>
 */
class KohePenjualanFactory extends Factory
{
    /**
     * Penjualan acak. Farm diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tanggal' => fake()->dateTimeBetween('-30 days')->format('Y-m-d'),
            'nama_pembeli' => fake()->name(),
            'jumlah_karung' => fake()->numberBetween(5, 50),
            'harga_per_karung' => fake()->numberBetween(5, 25) * 1000,
        ];
    }
}
