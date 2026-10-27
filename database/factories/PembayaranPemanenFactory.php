<?php

namespace Database\Factories;

use App\Models\PembayaranPemanen;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PembayaranPemanen>
 */
class PembayaranPemanenFactory extends Factory
{
    /**
     * Upah Rp 500.000 yang dibayar hari ini. Periode dan pemanen diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => fake()->firstName(),
            'jumlah' => 500_000,
            'dibayar_pada' => now(),
        ];
    }
}
