<?php

namespace Database\Factories;

use App\Models\KoheStok;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<KoheStok>
 */
class KoheStokFactory extends Factory
{
    /**
     * Stok masuk acak tanpa kandang asal. Farm diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tanggal' => fake()->dateTimeBetween('-30 days')->format('Y-m-d'),
            'jumlah_karung' => fake()->numberBetween(20, 300),
            'keterangan' => null,
        ];
    }
}
