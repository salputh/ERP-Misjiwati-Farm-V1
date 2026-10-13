<?php

namespace Database\Seeders;

use App\Models\Pemanen;
use Illuminate\Database\Seeder;

class PemanenSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (['Rizal', 'David', 'Dayat', 'Anju', 'Kondom'] as $nama) {
            Pemanen::query()->firstOrCreate(
                ['nama' => $nama],
                ['upah_per_kg' => 20],
            );
        }
    }
}
