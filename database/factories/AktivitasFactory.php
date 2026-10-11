<?php

namespace Database\Factories;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Aktivitas>
 */
class AktivitasFactory extends Factory
{
    /**
     * Aktivitas acak pada laporan harian atau sampling bobot.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'jenis' => fake()->randomElement(JenisAktivitas::cases()),
            'modul' => fake()->randomElement(ModulAktivitas::cases()),
            'subjek' => ucfirst(fake()->words(3, true)),
            'rincian' => 'Periode September 2026',
        ];
    }

    /**
     * Aktivitas dengan jenis aksi dan modul tertentu.
     */
    public function aksi(JenisAktivitas $jenis, ModulAktivitas $modul = ModulAktivitas::LaporanHarian): static
    {
        return $this->state(['jenis' => $jenis, 'modul' => $modul]);
    }

    /**
     * Aktivitas yang terjadi pada waktu tertentu.
     */
    public function pada(string $waktu): static
    {
        return $this->state(['created_at' => $waktu, 'updated_at' => $waktu]);
    }
}
