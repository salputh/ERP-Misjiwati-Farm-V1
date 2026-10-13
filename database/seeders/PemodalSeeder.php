<?php

namespace Database\Seeders;

use App\Models\Kandang;
use App\Models\Pemodal;
use Illuminate\Database\Seeder;

class PemodalSeeder extends Seeder
{
    public function run(): void
    {
        $muchrizan = Pemodal::updateOrCreate(['nama' => 'Muchrizan']);
        $muchrizan->kandangs()->sync([
            Kandang::where('nama', 'Kandang 1')->firstOrFail()->id => ['persen' => 79.9],
            Kandang::where('nama', 'Kandang 2')->firstOrFail()->id => ['persen' => 100],
        ]);

        $chatam = Pemodal::updateOrCreate(['nama' => 'Chatam']);
        $chatam->kandangs()->sync([
            Kandang::where('nama', 'Kandang 1')->firstOrFail()->id => ['persen' => 20.1],
        ]);
    }
}
