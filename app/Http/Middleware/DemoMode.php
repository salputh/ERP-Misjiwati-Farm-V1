<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DemoMode
{
    /**
     * Aksi Livewire yang hanya mengubah tampilan atau membaca data.
     *
     * @var array<string>
     */
    private const READ_ACTIONS = [
        '$refresh',
        'pilihKandang',
        'pilihTab',
        'pilihKategori',
        'pakaiKategori',
        'pilihJenis',
        'pilihModul',
        'muatLagi',
        'pilihTampilan',
        'pilihPerHalaman',
        'lihat',
        'setPage',
        'gotoPage',
        'nextPage',
        'previousPage',
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

        if (config('app.demo_readonly', false) && ! $request->isMethodSafe() && ! $this->isReadOnlyLivewireRequest($request)) {
            // Jika Livewire request, kembalikan response khusus
            if ($request->hasHeader('X-Livewire')) {
                return response()->json([
                    'error' => 'Mode demo: Fitur ini dinonaktifkan untuk menjaga data demo tetap konsisten.',
                ], 403)->header('X-Demo-Mode', 'true');
            }

            // Untuk request biasa, redirect dengan pesan
            return redirect()->back()->with('error', 'Mode demo: Fitur ini dinonaktifkan untuk menjaga data demo tetap konsisten.')->header('X-Demo-Mode', 'true');
        }

        $response = $next($request);
        $response->headers->set('X-Demo-Mode', 'true');

        return $response;
    }

    private function isReadOnlyLivewireRequest(Request $request): bool
    {
        if (! $request->isMethod('POST') || ! $request->routeIs('*livewire.update')) {
            return false;
        }

        $components = $request->input('components');
        if (! is_array($components) || $components === []) {
            return false;
        }

        foreach ($components as $component) {
            if (! is_array($component) || ! isset($component['calls']) || ! is_array($component['calls'])) {
                return false;
            }

            foreach ($component['calls'] as $call) {
                if (! is_array($call) || ! in_array($call['method'] ?? null, self::READ_ACTIONS, true)) {
                    return false;
                }
            }
        }

        return true;
    }
}
