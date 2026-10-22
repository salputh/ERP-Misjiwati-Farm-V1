<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectTask>
 */
class ProjectTaskFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'karyawan_id' => null,
            'nama' => fake()->sentence(5),
            'status' => 'pending',
            'tanggal_selesai' => today()->addWeek(),
        ];
    }
}
