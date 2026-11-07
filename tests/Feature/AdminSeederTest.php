<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class AdminSeederTest extends TestCase
{
    use RefreshDatabase;

    private function isiLingkungan(string $email, string $password): void
    {
        config(['app.admin' => ['nama' => 'Pemilik', 'email' => $email, 'password' => $password]]);
    }

    public function test_membuat_akun_admin_dengan_password_ter_hash(): void
    {
        $this->isiLingkungan('pemilik@contoh.test', 'kata-sandi-panjang-1');

        $this->seed(AdminSeeder::class);

        $pengguna = User::query()->where('email', 'pemilik@contoh.test')->firstOrFail();
        $this->assertSame('Pemilik', $pengguna->name);
        $this->assertTrue(Hash::check('kata-sandi-panjang-1', $pengguna->password));
    }

    public function test_dijalankan_ulang_tidak_menggandakan_akun(): void
    {
        $this->isiLingkungan('pemilik@contoh.test', 'kata-sandi-panjang-1');
        $this->seed(AdminSeeder::class);
        $this->seed(AdminSeeder::class);

        $this->assertSame(1, User::query()->where('email', 'pemilik@contoh.test')->count());
    }

    public function test_menolak_password_pendek(): void
    {
        $this->isiLingkungan('pemilik@contoh.test', 'pendek');

        $this->expectException(RuntimeException::class);
        $this->seed(AdminSeeder::class);
    }
}
