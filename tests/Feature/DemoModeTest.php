<?php

namespace Tests\Feature;

use App\Livewire\MasterUangMakan;
use App\Livewire\Projects;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class DemoModeTest extends TestCase
{
    use RefreshDatabase;

    public function test_visitors_enter_the_dashboard_as_the_demo_user(): void
    {
        config(['app.demo_mode' => true]);
        $demo = User::factory()->create(['email' => 'demo@misjiwatifarm.tech']);
        $this->keluarkanPengguna();

        $this->get('/')->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($demo);
        $this->get(route('dashboard'))->assertOk()->assertHeader('X-Demo-Mode', 'true')->assertSee('Versi Demo');
    }

    public function test_missing_demo_user_returns_503_without_a_redirect_loop(): void
    {
        config(['app.demo_mode' => true]);
        $this->keluarkanPengguna();

        $this->get(route('login'))->assertServiceUnavailable();

        $this->assertGuest();
    }

    #[TestWith(['POST'])]
    #[TestWith(['PUT'])]
    #[TestWith(['PATCH'])]
    #[TestWith(['DELETE'])]
    public function test_readonly_requests_are_rejected_before_writing_data(string $method): void
    {
        config(['app.demo_mode' => true, 'app.demo_readonly' => true]);
        Route::match([$method], '/demo-test-write', function () {
            User::factory()->create(['email' => 'write@demo.test']);

            return response()->noContent();
        })->middleware('web');

        $this->call($method, '/demo-test-write', server: ['HTTP_X_LIVEWIRE' => 'true'])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'write@demo.test']);
    }

    public function test_readonly_browser_request_keeps_the_user_logged_in(): void
    {
        config(['app.demo_mode' => true, 'app.demo_readonly' => true]);
        $demo = User::factory()->create(['email' => 'demo@misjiwatifarm.tech']);

        $this->actingAs($demo)->from('/dashboard')->post(route('logout'))
            ->assertRedirect('/dashboard')->assertSessionHas('error');

        $this->assertAuthenticatedAs($demo);
    }

    public function test_writable_demo_allows_changes(): void
    {
        config(['app.demo_mode' => true, 'app.demo_readonly' => false]);
        Route::post('/demo-test-write', function () {
            User::factory()->create(['email' => 'write@demo.test']);

            return response()->noContent();
        })->middleware('web');

        $this->post('/demo-test-write')->assertNoContent()->assertHeader('X-Demo-Mode', 'true');

        $this->assertDatabaseHas('users', ['email' => 'write@demo.test']);
    }

    public function test_readonly_livewire_filters_and_view_switches_still_work(): void
    {
        config(['app.demo_mode' => true, 'app.demo_readonly' => true]);
        $component = Livewire::test(Projects::class);

        $response = $this->postJson(route('default-livewire.update'), ['components' => [[
            'snapshot' => json_encode($component->snapshot),
            'updates' => ['cari' => 'Demo'],
            'calls' => [['method' => 'pilihTampilan', 'params' => ['list']]],
        ]]], ['X-Livewire' => 'true']);

        $response->assertOk()->assertHeader('X-Demo-Mode', 'true');
        $snapshot = json_decode($response->json('components.0.snapshot'), true);
        $this->assertSame('Demo', $snapshot['data']['cari']);
        $this->assertSame('list', $snapshot['data']['tampilan']);
    }

    public function test_readonly_livewire_save_cannot_change_master_data(): void
    {
        config(['app.demo_mode' => true, 'app.demo_readonly' => true]);
        $component = Livewire::test(MasterUangMakan::class);
        $settings = DB::table('pengaturans')->get()->toArray();

        $this->postJson(route('default-livewire.update'), ['components' => [[
            'snapshot' => json_encode($component->snapshot),
            'updates' => ['perHari' => '100', 'hari' => '1'],
            'calls' => [['method' => 'simpan', 'params' => []]],
        ]]], ['X-Livewire' => 'true'])->assertForbidden();

        $this->assertEquals($settings, DB::table('pengaturans')->get()->toArray());
    }
}
