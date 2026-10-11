<?php

namespace Database\Factories;

use App\Enums\Jabatan;
use App\Models\SlipGaji;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SlipGaji>
 */
class SlipGajiFactory extends Factory
{
    /**
     * Joker bergaji pokok tanpa premi dan tanpa potongan. Kandang periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => fake()->unique()->firstName(),
            'jabatan' => Jabatan::Joker,
            'hari_kerja' => 30,
            'gaji_pokok' => 2_000_000,
            'urutan' => 0,
        ];
    }
}
