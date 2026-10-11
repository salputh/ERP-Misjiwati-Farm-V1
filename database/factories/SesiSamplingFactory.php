<?php

namespace Database\Factories;

use App\Models\SesiSampling;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SesiSampling>
 */
class SesiSamplingFactory extends Factory
{
    /**
     * Kandang periode, tanggal, dan umur diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'dengan_sexing' => false,
        ];
    }

    public function denganSexing(): static
    {
        return $this->state(['dengan_sexing' => true]);
    }
}
