<?php

namespace App\Providers;

use App\Models\Kandang;
use Illuminate\Support\Facades\Blade;
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

        // Daftar kandang untuk dropdown sidebar pada modul yang dibuka per kandang.
        View::composer('partials._menu', fn ($view) => $view->with('kandangMenu', Kandang::orderBy('nama')->get()));

        // @kurung($nilai, 3): sama, tetapi nilai negatif ditulis dalam kurung dan null dikosongkan.
        Blade::directive('kurung', fn (string $ekspresi): string => "<?php echo e(\\App\\Support\\Format::kurung($ekspresi)); ?>");
    }
}
