<?php

namespace Database\Factories;

use App\Models\NotaPanen;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<NotaPanen>
 */
class NotaPanenFactory extends Factory
{
    /**
     * Periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $mulai = Carbon::instance(fake()->dateTimeBetween('-7 days'))->setTime(fake()->numberBetween(20, 23), fake()->numberBetween(0, 59));
        $ekor = fake()->numberBetween(300, 1900);
        $berat = round($ekor * fake()->randomFloat(2, 1.3, 2.1), 1);

        return [
            'tanggal_panen' => $mulai->toDateString(),
            'no_spa' => fake()->unique()->numerify('189011####'),
            'no_btpa' => fake()->unique()->numerify('1####'),
            'no_polisi' => fake()->bothify('BM #### ??'),
            'pembeli' => fake()->company(),
            'mulai' => $mulai,
            'selesai' => $mulai->copy()->addMinutes(fake()->numberBetween(15, 90)),
            'jumlah_krat' => (int) ceil($ekor / 13),
            'ekor' => $ekor,
            'berat_kg' => $berat,
            'netto_nota_kg' => $berat,
        ];
    }
}
