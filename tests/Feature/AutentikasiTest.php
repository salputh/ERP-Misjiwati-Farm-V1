<?php

namespace Tests\Feature;

use App\Livewire\Masuk;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Autentikasi: seluruh halaman hanya terbuka setelah masuk, percobaan masuk yang salah dibatasi,
 * dan akun hanya dibuat lewat perintah pengguna:atur.
 */
class AutentikasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->keluarkanPengguna();
    }

    public function test_guests_are_sent_to_the_login_page(): void
    {
        $this->get(route('dashboard'))->assertRedirect(route('login'));
        $this->get(route('payroll.abk'))->assertRedirect(route('login'));
        $this->get(route('panen.export', ['periode' => 1]))->assertRedirect(route('login'));
        $this->get('/produksi/apa-saja')->assertRedirect(route('login'));
    }

    public function test_login_page_and_health_check_are_open_to_guests(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertSee('Masuk ke ERP')
            ->assertDontSee('Keluar');

        $this->get('/up')->assertOk();
    }

    public function test_the_right_credentials_log_the_user_in(): void
    {
        $pengguna = User::factory()->create(['email' => 'pemilik@misjiwati.test']);

        Livewire::test(Masuk::class)
            ->set('email', 'pemilik@misjiwati.test')
            ->set('password', 'password')
            ->call('masuk')
            ->assertHasNoErrors()
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($pengguna);
    }

    public function test_a_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'pemilik@misjiwati.test']);

        Livewire::test(Masuk::class)
            ->set('email', 'pemilik@misjiwati.test')
            ->set('password', 'bukan-password')
            ->call('masuk')
            ->assertHasErrors(['email'])
            ->assertSee('Email atau password salah.')
            ->assertSet('password', '');

        $this->assertGuest();
    }

    public function test_login_is_locked_after_five_wrong_attempts(): void
    {
        User::factory()->create(['email' => 'pemilik@misjiwati.test']);

        for ($percobaan = 0; $percobaan < Masuk::BATAS_PERCOBAAN; $percobaan++) {
            Livewire::test(Masuk::class)
                ->set('email', 'pemilik@misjiwati.test')
                ->set('password', 'tebakan-'.$percobaan)
                ->call('masuk');
        }

        Livewire::test(Masuk::class)
            ->set('email', 'pemilik@misjiwati.test')
            ->set('password', 'password')
            ->call('masuk')
            ->assertHasErrors(['email'])
            ->assertSee('Terlalu banyak percobaan masuk.');

        $this->assertGuest();
    }

    public function test_signed_in_users_see_their_name_and_can_log_out(): void
    {
        $pengguna = User::factory()->create(['name' => 'Salman']);

        $this->actingAs($pengguna)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertSee('Salman')
            ->assertSee(route('logout'));

        $this->get(route('login'))->assertRedirect(route('dashboard'));

        $this->post(route('logout'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_the_user_command_creates_a_user_and_resets_a_password(): void
    {
        $this->artisan('pengguna:atur', ['email' => 'Admin@Misjiwati.test', '--nama' => 'Admin Keuangan'])
            ->expectsQuestion('Password baru (minimal 12 karakter)', 'sandi-yang-panjang')
            ->expectsQuestion('Ulangi password', 'sandi-yang-panjang')
            ->expectsOutput('Pengguna admin@misjiwati.test dibuat.')
            ->assertSuccessful();

        $pengguna = User::query()->where('email', 'admin@misjiwati.test')->sole();
        $this->assertSame('Admin Keuangan', $pengguna->name);
        $this->assertTrue(Hash::check('sandi-yang-panjang', $pengguna->password));

        $this->artisan('pengguna:atur', ['email' => 'admin@misjiwati.test'])
            ->expectsConfirmation('Pengguna admin@misjiwati.test sudah ada. Ganti password-nya?', 'yes')
            ->expectsQuestion('Password baru (minimal 12 karakter)', 'sandi-pengganti-baru')
            ->expectsQuestion('Ulangi password', 'sandi-pengganti-baru')
            ->expectsOutput('Password admin@misjiwati.test diganti.')
            ->assertSuccessful();

        $this->assertTrue(Hash::check('sandi-pengganti-baru', $pengguna->fresh()->password));
        $this->assertSame(1, User::count());
    }

    public function test_the_user_command_rejects_a_short_password(): void
    {
        $this->artisan('pengguna:atur', ['email' => 'admin@misjiwati.test', '--nama' => 'Admin'])
            ->expectsQuestion('Password baru (minimal 12 karakter)', 'pendek')
            ->expectsQuestion('Ulangi password', 'pendek')
            ->expectsOutput('Password minimal 12 karakter.')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }
}
