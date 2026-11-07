<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Enums\StatusMasuk;
use App\Livewire\DaftarAkun;
use App\Livewire\Masuk;
use App\Models\Aktivitas;
use App\Models\Farm;
use App\Models\Sesi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Akun pengguna: menambah, mengubah, dan menghapus akun, serta melihat siapa yang sedang masuk dari tabel sessions.
 */
class DaftarAkunTest extends TestCase
{
    use RefreshDatabase;

    private User $saya;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-28 09:00:00');
        $this->saya = User::factory()->create(['name' => 'Salman Putra', 'email' => 'salman@misjiwati.test']);
        $this->actingAs($this->saya);
    }

    public function test_accounts_show_their_login_status_from_unexpired_sessions(): void
    {
        $budi = User::factory()->create(['name' => 'Budi']);
        Sesi::factory()->for($budi)->terakhirAktif(2)->create();
        Sesi::factory()->for($budi)->iphone()->terakhirAktif(40)->create();
        Sesi::factory()->for(User::factory()->create(['name' => 'Citra']))->terakhirAktif(30)->create();
        Sesi::factory()->for(User::factory()->create(['name' => 'Dedi']))->terakhirAktif(config('session.lifetime') + 1)->create();
        User::factory()->create(['name' => 'Eka']);

        $halaman = Livewire::test(DaftarAkun::class);
        $status = collect($halaman->instance()->daftar)
            ->mapWithKeys(fn (array $baris): array => [$baris['akun']->name => [$baris['status'], $baris['sesi']->count()]])
            ->all();

        $this->assertSame([
            'Budi' => [StatusMasuk::Online, 2],
            'Citra' => [StatusMasuk::Diam, 1],
            'Dedi' => [StatusMasuk::Keluar, 0],
            'Eka' => [StatusMasuk::Keluar, 0],
            'Salman Putra' => [StatusMasuk::Keluar, 0],
        ], $status);
        $this->assertSame(1, $halaman->instance()->jumlahOnline);
        $this->assertCount(3, $halaman->instance()->sesiMasuk);
    }

    public function test_signed_in_devices_are_listed_newest_first_without_exposing_session_ids(): void
    {
        $budi = User::factory()->create(['name' => 'Budi']);
        $iphone = Sesi::factory()->for($budi)->iphone()->terakhirAktif(10)->create(['ip_address' => '10.0.0.7']);
        Sesi::factory()->for($this->saya)->create(['id' => session()->getId()]);

        Livewire::test(DaftarAkun::class)
            ->assertSee('Sedang masuk')
            ->assertSeeInOrder(['Salman Putra', 'Chrome di macOS', 'Perangkat ini', 'Budi', 'Safari di iOS', '10.0.0.7'])
            ->assertSeeHtml('bi-phone')
            ->assertDontSee($iphone->id)
            ->assertDontSee(session()->getId());
    }

    public function test_page_says_so_when_nobody_is_signed_in(): void
    {
        $this->get(route('akun'))
            ->assertOk()
            ->assertSee('Tidak ada yang sedang masuk')
            ->assertSee('Salman Putra')
            ->assertSee('Anda');
    }

    public function test_a_new_account_can_sign_in_and_is_recorded_in_the_activity_history(): void
    {
        Livewire::test(DaftarAkun::class)
            ->call('tambah')
            ->set('nama', '  Rina   Wati ')
            ->set('email', ' Rina@Misjiwati.TEST ')
            ->set('password', 'password-rahasia')
            ->set('password_confirmation', 'password-rahasia')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Akun Rina Wati ditambahkan.')
            ->assertSet('password', '')
            ->assertDispatched('tutup-modal-akun');

        $rina = User::query()->where('email', 'rina@misjiwati.test')->sole();
        $this->assertSame('Rina Wati', $rina->name);
        $this->assertTrue(Hash::check('password-rahasia', $rina->password));

        $aktivitas = Aktivitas::query()->sole();
        $this->assertSame(JenisAktivitas::Tambah, $aktivitas->jenis);
        $this->assertSame(ModulAktivitas::Akun, $aktivitas->modul);
        $this->assertSame('Akun Rina Wati', $aktivitas->subjek);
        $this->assertSame('rina@misjiwati.test', $aktivitas->rincian);
    }

    public function test_a_new_account_needs_a_unique_email_and_a_long_confirmed_password(): void
    {
        Livewire::test(DaftarAkun::class)
            ->set('nama', 'Rina')
            ->set('email', 'SALMAN@misjiwati.test')
            ->set('password', 'pendek')
            ->set('password_confirmation', 'lain')
            ->call('simpan')
            ->assertHasErrors(['email' => 'unique', 'password' => 'min'])
            ->set('email', 'rina@misjiwati.test')
            ->set('password', 'password-rahasia')
            ->call('simpan')
            ->assertHasErrors(['password' => 'confirmed'])
            ->set('password', '')
            ->call('simpan')
            ->assertHasErrors(['password' => 'required']);

        $this->assertSame(1, User::query()->count());
        $this->assertSame(0, Aktivitas::query()->count());
    }

    public function test_changing_a_password_signs_the_account_out_of_its_other_devices(): void
    {
        $budi = User::factory()->create(['name' => 'Budi', 'email' => 'budi@misjiwati.test']);
        $tokenLama = $budi->remember_token;
        Sesi::factory()->for($budi)->count(2)->create();
        $sesiSaya = Sesi::factory()->for($this->saya)->create();

        Livewire::test(DaftarAkun::class)
            ->call('ubah', $budi->id)
            ->assertSet('nama', 'Budi')
            ->assertSet('email', 'budi@misjiwati.test')
            ->assertSet('password', '')
            ->set('password', 'password-baru-budi')
            ->set('password_confirmation', 'password-baru-budi')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Akun Budi diperbarui.');

        $budi->refresh();
        $this->assertTrue(Hash::check('password-baru-budi', $budi->password));
        $this->assertNotSame($tokenLama, $budi->remember_token);
        $this->assertSame(0, $budi->sesi()->count());
        $this->assertModelExists($sesiSaya);
        $this->assertSame('budi@misjiwati.test, password diganti', Aktivitas::query()->sole()->rincian);
    }

    public function test_renaming_without_a_new_password_keeps_the_account_signed_in(): void
    {
        $budi = User::factory()->create(['name' => 'Budi']);
        $passwordLama = $budi->password;
        Sesi::factory()->for($budi)->create();

        Livewire::test(DaftarAkun::class)
            ->call('ubah', $budi->id)
            ->set('nama', 'Budi Santoso')
            ->call('simpan')
            ->assertHasNoErrors();

        $budi->refresh();
        $this->assertSame('Budi Santoso', $budi->name);
        $this->assertSame($passwordLama, $budi->password);
        $this->assertSame(1, $budi->sesi()->count());
        $this->assertSame(JenisAktivitas::Ubah, Aktivitas::query()->sole()->jenis);
    }

    public function test_saving_an_unchanged_account_records_nothing(): void
    {
        Livewire::test(DaftarAkun::class)
            ->call('ubah', $this->saya->id)
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertSame(0, Aktivitas::query()->count());
    }

    public function test_deleting_an_account_signs_it_out_everywhere(): void
    {
        $budi = User::factory()->create(['name' => 'Budi', 'email' => 'budi@misjiwati.test']);
        Sesi::factory()->for($budi)->count(2)->create();

        Livewire::test(DaftarAkun::class)
            ->call('mintaHapus', $budi->id)
            ->assertSet('namaHapus', 'Budi')
            ->call('hapus')
            ->assertHasNoErrors()
            ->assertSet('pesan', 'Akun Budi dihapus.');

        $this->assertModelMissing($budi);
        $this->assertSame(0, Sesi::query()->count());

        $aktivitas = Aktivitas::query()->sole();
        $this->assertSame(JenisAktivitas::Hapus, $aktivitas->jenis);
        $this->assertSame('Akun Budi', $aktivitas->subjek);
    }

    public function test_the_account_in_use_cannot_be_deleted(): void
    {
        Livewire::test(DaftarAkun::class)
            ->assertDontSee('Hapus akun Salman Putra')
            ->call('mintaHapus', $this->saya->id)
            ->call('hapus')
            ->assertHasErrors(['akun_hapus']);

        $this->assertModelExists($this->saya);
        $this->assertSame(0, Aktivitas::query()->count());
    }

    public function test_signing_in_records_the_last_login_time_without_touching_the_account(): void
    {
        $budi = User::factory()->create(['email' => 'budi@misjiwati.test', 'updated_at' => '2026-10-01 08:00:00']);
        $this->keluarkanPengguna();
        Carbon::setTestNow('2026-10-28 10:15:00');

        Livewire::test(Masuk::class)
            ->set('email', 'budi@misjiwati.test')
            ->set('password', 'password')
            ->call('masuk')
            ->assertHasNoErrors();

        $budi->refresh();
        $this->assertSame('2026-10-28 10:15:00', $budi->terakhir_masuk_at->toDateTimeString());
        $this->assertSame('2026-10-01 08:00:00', $budi->updated_at->toDateTimeString());
    }

    public function test_sidebar_links_to_the_accounts_page(): void
    {
        $this->get(route('akun'))
            ->assertOk()
            ->assertSee('Pengaturan')
            ->assertSee('href="'.route('akun', ['farm' => Farm::query()->sole()->id]).'" class="basalt-menu-entry active"', false);
    }
}
