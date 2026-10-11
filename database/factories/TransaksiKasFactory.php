<?php

namespace Database\Factories;

use App\Enums\KategoriKas;
use App\Models\TransaksiKas;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransaksiKas>
 */
class TransaksiKasFactory extends Factory
{
    /**
     * Pengeluaran acak. Kandang periode diisi oleh pemanggil.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tanggal' => fake()->dateTimeBetween('-30 days')->format('Y-m-d'),
            'kategori' => fake()->randomElement(KategoriKas::pengeluaran()),
            'uraian' => fake()->words(3, true),
            'jumlah' => fake()->numberBetween(5, 2000) * 1000,
        ];
    }

    /**
     * Dana operasional yang masuk ke kas.
     */
    public function danaMasuk(int $jumlah = 10_000_000): static
    {
        return $this->state(['kategori' => KategoriKas::DanaOperasional, 'uraian' => 'Uang masuk (operasional)', 'jumlah' => $jumlah]);
    }

    /**
     * Pengeluaran pada kategori tertentu.
     */
    public function keluar(KategoriKas $kategori, int $jumlah): static
    {
        return $this->state(['kategori' => $kategori, 'jumlah' => $jumlah]);
    }
}
