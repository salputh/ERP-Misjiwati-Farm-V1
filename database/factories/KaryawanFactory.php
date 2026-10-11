<?php

namespace Database\Factories;

use App\Enums\Jabatan;
use App\Models\Karyawan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Karyawan>
 */
class KaryawanFactory extends Factory
{
    /**
     * ABK yang belum ditempatkan di kandang.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => fake()->unique()->firstName(),
            'jabatan' => Jabatan::Abk,
        ];
    }

    public function joker(): static
    {
        return $this->state(['jabatan' => Jabatan::Joker]);
    }
}
