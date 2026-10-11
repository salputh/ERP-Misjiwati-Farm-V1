<?php

namespace Database\Factories;

use App\Models\BagiHasil;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BagiHasil>
 */
class BagiHasilFactory extends Factory
{
    /**
     * Tarif seperti lembar bagi hasil periode Juli 2026, tanpa premi. Kandang periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'controller' => fake()->firstName(),
            'operasional' => fake()->numberBetween(40_000, 80_000) * 1000,
            'tarif_gaji_abk_per_kg' => 500,
            'premi_pemeliharaan_abk' => 0,
            'premi_controller' => 0,
            'persen_upah_controller' => 3,
            'persen_bonus_pasar_abk' => 30,
            'persen_bonus_pasar_controller' => 10,
            'persen_zakat' => 2.5,
        ];
    }
}
