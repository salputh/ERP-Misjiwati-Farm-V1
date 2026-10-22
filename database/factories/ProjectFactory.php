<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => fake()->sentence(3),
            'kategori' => fake()->randomElement(['Produksi', 'Operasional', 'Perawatan']),
            'deskripsi' => fake()->sentence(),
            'status' => 'planned',
            'tanggal_mulai' => today(),
            'tanggal_selesai' => today()->addWeeks(3),
        ];
    }
}
