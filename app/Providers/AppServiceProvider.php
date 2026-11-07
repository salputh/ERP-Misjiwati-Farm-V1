<?php

namespace App\Providers;

use App\Models\Farm;
use App\Models\Periode;
use App\Models\User;
use App\Support\Notifikasi;
use Illuminate\Auth\Events\Login;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // @angka($nilai) atau @angka($nilai, 2): angka berformat Indonesia.
        Blade::directive('angka', fn (string $ekspresi): string => "<?php echo e(\\App\\Support\\Format::angka($ekspresi)); ?>");

        View::composer('partials._menu', function ($view): void {
            $farm = $this->farmDariPermintaan();
            $periode = $this->periodeDariPermintaan($farm);
            $kandangMenu = $periode
                ? $periode->kandangPeriode()->with('kandang')->get()->pluck('kandang')->sortBy('nama')->values()
                : collect();

            $daftarFarm = Farm::query()->orderBy('nama')->get();
            $daftarPeriode = $farm?->periodes()->prioritaskanAktif()->get() ?? collect();
            $periodeTerpilih = $periode;

            $view->with(compact('farm', 'periode', 'kandangMenu', 'daftarFarm', 'daftarPeriode', 'periodeTerpilih'));
        });

        View::composer('partials._top_nav', function ($view): void {
            $daftarFarm = Farm::query()->orderBy('nama')->get();
            $farm = $this->farmDariPermintaan($daftarFarm);
            $daftarPeriode = $farm?->periodes()->prioritaskanAktif()->get() ?? collect();
            $periodeTerpilih = $daftarPeriode->firstWhere('id', (int) request()->query('periode'))
                ?? $daftarPeriode->first();

            $notifikasi = Notifikasi::untukPeriode($periodeTerpilih);

            $view->with(compact('daftarFarm', 'farm', 'daftarPeriode', 'periodeTerpilih', 'notifikasi'));
        });

        // Waktu masuk terakhir tiap akun, termasuk masuk otomatis lewat "ingat saya"; updated_at akun tidak ikut berubah.
        Event::listen(Login::class, function (Login $masuk): void {
            if ($masuk->user instanceof User) {
                User::withoutTimestamps(fn () => $masuk->user->forceFill(['terakhir_masuk_at' => now()])->saveQuietly());
            }
        });

        // @kurung($nilai, 3): sama, tetapi nilai negatif ditulis dalam kurung dan null dikosongkan.
        Blade::directive('kurung', fn (string $ekspresi): string => "<?php echo e(\\App\\Support\\Format::kurung($ekspresi)); ?>");
    }

    private function farmDariPermintaan(?Collection $daftarFarm = null): ?Farm
    {
        $daftarFarm ??= Farm::query()->orderBy('nama')->get();
        $farm = $daftarFarm->firstWhere('id', (int) request()->query('farm'));

        if ($farm) {
            return $farm;
        }

        $periode = Periode::query()->find(request()->query('periode'));

        return $periode
            ? $daftarFarm->firstWhere('id', $periode->farm_id)
            : $daftarFarm->first();
    }

    private function periodeDariPermintaan(?Farm $farm): ?Periode
    {
        if (! $farm) {
            return null;
        }

        return $farm->periodes()
            ->whereKey(request()->query('periode'))
            ->first()
            ?? $farm->periodes()->prioritaskanAktif()->first();
    }
}
