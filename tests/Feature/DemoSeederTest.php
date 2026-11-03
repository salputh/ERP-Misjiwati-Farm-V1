<?php

namespace Tests\Feature;

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_creates_complete_data_without_original_identities(): void
    {
        config(['app.demo_mode' => true]);

        $this->seed(DemoSeeder::class);

        $this->assertDatabaseHas('users', ['email' => 'demo@misjiwatifarm.tech']);
        $this->assertDatabaseCount('karyawans', 9);
        $this->assertDatabaseHas('karyawans', ['nama' => 'Budi Santoso']);
        $this->assertDatabaseHas('pemodals', ['nama' => 'PT Maju Sejahtera']);
        $this->assertDatabaseCount('kasbons', 3);
        $this->assertDatabaseCount('kohe_stoks', 4);
        $this->assertDatabaseCount('slip_gajis', 9);
        $this->assertDatabaseHas('recordings', ['umur' => 24]);
        $this->assertDatabaseCount('sesi_samplings', 20);
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));

        foreach (['karyawans', 'pemodals', 'pemanens', 'nota_panens', 'nota_panen_pemanens', 'transaksi_kas', 'bagi_hasils', 'penerima_bagi_hasils', 'slip_gajis', 'periodes'] as $table) {
            $data = DB::table($table)->get()->toJson();
            foreach (['Wahyu', 'Angga', 'Muchrizan', 'Chatam', 'Rohim', 'Frengky', 'Rizal', 'David', 'An Nisa', 'Salman', 'CHIKO', 'ABDILLAH', 'Indojaya', 'BM 8591 DT', '1890115910'] as $identity) {
                $this->assertStringNotContainsString($identity, $data, "$table masih memuat $identity");
            }
        }

        $this->get('/dashboard')->assertOk();
        $this->get('/produksi/recording-harian?periode=1')->assertOk();
        $this->get('/produksi/sampling-bobot?periode=1')->assertOk();
        $this->get('/produksi/panen?periode=1')->assertOk();
        $this->get('/keuangan/rhpp?periode=1')->assertOk();
        $this->get('/keuangan/bagi-hasil/1?periode=1')->assertOk();
        $this->get('/keuangan/bagi-hasil/2?periode=1')->assertOk();
        $this->get('/keuangan/payroll-abk?periode=1')->assertOk();
        $this->get('/keuangan/kasbon-abk?periode=1')->assertOk();
        $this->get('/master')->assertOk();
    }

    public function test_demo_seed_refuses_to_run_outside_demo_mode(): void
    {
        config(['app.demo_mode' => false]);
        $farmCount = DB::table('farms')->count();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('DemoSeeder hanya boleh dijalankan');
        try {
            $this->seed(DemoSeeder::class);
        } finally {
            $this->assertDatabaseEmpty('users');
            $this->assertDatabaseCount('farms', $farmCount);
        }
    }
}
