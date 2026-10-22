<?php

namespace Database\Seeders;

use App\Models\Karyawan;
use App\Models\Project;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (Project::query()->exists()) {
            return;
        }

        $karyawan = Karyawan::query()->get();
        $proyek = [
            ['nama' => 'Peningkatan ventilasi kandang', 'kategori' => 'Perawatan', 'status' => 'in_progress', 'mulai' => today()->subDays(8), 'selesai' => today()->addDays(14), 'tugas' => ['Pemeriksaan kipas dan panel', 'Penggantian belt kipas', 'Uji aliran udara']],
            ['nama' => 'Penataan pencatatan produksi', 'kategori' => 'Operasional', 'status' => 'planned', 'mulai' => today()->addDays(3), 'selesai' => today()->addDays(24), 'tugas' => ['Inventarisasi formulir', 'Penyusunan alur pencatatan']],
            ['nama' => 'Perawatan jalur air minum', 'kategori' => 'Produksi', 'status' => 'completed', 'mulai' => today()->subDays(20), 'selesai' => today()->subDays(4), 'tugas' => ['Pemeriksaan pipa', 'Pembersihan tandon']],
        ];

        foreach ($proyek as $data) {
            $project = Project::create([
                'nama' => $data['nama'],
                'kategori' => $data['kategori'],
                'status' => $data['status'],
                'tanggal_mulai' => $data['mulai'],
                'tanggal_selesai' => $data['selesai'],
            ]);
            $project->anggota()->sync($karyawan->take(3)->modelKeys());

            foreach ($data['tugas'] as $index => $namaTugas) {
                $project->tugas()->create([
                    'nama' => $namaTugas,
                    'status' => $data['status'] === 'completed' || ($index === 0 && $data['status'] === 'in_progress') ? 'completed' : 'pending',
                    'karyawan_id' => $karyawan->isNotEmpty() ? $karyawan[$index % $karyawan->count()]->id : null,
                ]);
            }
        }
    }
}
