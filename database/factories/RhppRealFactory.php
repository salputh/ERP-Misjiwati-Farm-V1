<?php

namespace Database\Factories;

use App\Models\RhppReal;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RhppReal>
 */
class RhppRealFactory extends Factory
{
    /**
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'status' => 'sementara',
            'kantor' => fake()->city(),
            'no_siklus' => fake()->numerify('F0##########'),
            'ppl' => fake()->name(),
            'tanggal_proses' => fake()->dateTimeBetween('-30 days'),
            'doc_ekor' => 20000,
            'doc_total' => 20000 * 9000,
            'pakan_kg' => 50000,
            'pakan_total' => 50000 * 9900,
            'ovk_jumlah' => 1000,
            'ovk_satuan' => 'GR',
            'ovk_total' => 1_000_000,
            'fcr_aktual' => fake()->randomFloat(3, 1.3, 1.6),
            'fcr_standar' => 1.5,
            'deplesi_persen' => fake()->randomFloat(1, 1, 5),
            'deplesi_standar_persen' => 3.6,
            'umur_rata' => fake()->randomFloat(2, 28, 35),
            'ip' => fake()->numberBetween(350, 450),
            'tarif_efisiensi_per_kg' => 260,
            'subsidi_harga_pasar' => fake()->numberBetween(10, 100) * 1_000_000,
        ];
    }
}
