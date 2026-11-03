<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DemoMode
{
    /**
     * Daftar route yang boleh diakses di demo mode (read-only).
     *
     * @var array<string>
     */
    private const ALLOWED_ROUTES = [
        'dashboard',
        'aktivitas',
        'periode.index',
        'project.index',
        'project.show',
        'recording.harian',
        'recording.harian.export',
        'laporan.harian',
        'pakan.log',
        'sampling.bobot',
        'panen.rekap',
        'panen.export',
        'rhpp.index',
        'kas.operasional',
        'bagi-hasil.index',
        'bagi-hasil.export',
        'payroll.abk',
        'payroll.pemanen',
        'kasbon.abk',
        'master.data',
        'kohe.stok',
        'standar-strain.index',
        'modul.index',
        'akun.index',
    ];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Jika tidak dalam mode demo, lanjutkan normal
        if (! config('app.demo_mode', false)) {
            return $next($request);
        }

        // Tambahkan header untuk identifikasi demo
        $response = $next($request);

        if ($response instanceof Response) {
            $response->headers->set('X-Demo-Mode', 'true');
        }

        // Jika readonly mode aktif, blokir semua method selain GET dan HEAD
        if (config('app.demo_readonly', false) && ! $request->isMethodSafe()) {
            // Jika Livewire request, kembalikan response khusus
            if ($request->hasHeader('X-Livewire')) {
                return response()->json([
                    'error' => 'Mode demo: Fitur ini dinonaktifkan untuk menjaga data demo tetap konsisten.',
                ], 403);
            }

            // Untuk request biasa, redirect dengan pesan
            return redirect()->back()->with('error', 'Mode demo: Fitur ini dinonaktifkan untuk menjaga data demo tetap konsisten.');
        }

        return $response;
    }
}
