<?php

namespace Database\Factories;

use App\Enums\PeranBagiHasil;
use App\Models\PenerimaBagiHasil;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PenerimaBagiHasil>
 */
class PenerimaBagiHasilFactory extends Factory
{
    /**
     * ABK tanpa premi tetap. Bagi hasil diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'peran' => PeranBagiHasil::Abk,
            'nama' => fake()->firstName(),
            'urutan' => 0,
        ];
    }

    /**
     * ABK dengan premi tetap, misalnya ketua ABK.
     */
    public function premiTetap(int $jumlah): static
    {
        return $this->state(['peran' => PeranBagiHasil::Abk, 'jumlah' => $jumlah, 'keterangan' => 'ketua ABK']);
    }

    public function bonusPasar(int $jumlah, bool $dijumlahkan = true): static
    {
        return $this->state(['peran' => PeranBagiHasil::BonusPasar, 'jumlah' => $jumlah, 'dijumlahkan' => $dijumlahkan]);
    }

    public function entertain(int $jumlah): static
    {
        return $this->state(['peran' => PeranBagiHasil::Entertain, 'jumlah' => $jumlah]);
    }

    public function pemodal(float $persen): static
    {
        return $this->state(['peran' => PeranBagiHasil::Pemodal, 'persen' => $persen]);
    }
}
