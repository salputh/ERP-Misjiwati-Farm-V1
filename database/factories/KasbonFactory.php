<?php

namespace Database\Factories;

use App\Models\Karyawan;
use App\Models\Kasbon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Kasbon>
 */
class KasbonFactory extends Factory
{
    /**
     * Kasbon HP Rp 3.000.000 yang dikembalikan dalam 3 kali potongan gaji, uangnya dari luar kas kandang.
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'karyawan_id' => Karyawan::factory(),
            'tanggal' => fake()->dateTimeBetween('-1 month')->format('Y-m-d'),
            'keperluan' => 'HP',
            'jumlah' => 3_000_000,
            'jumlah_potongan' => 3,
        ];
    }
}
