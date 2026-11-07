<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Melindungi pintu integrasi dengan satu token rahasia dari .env (header Authorization: Bearer ...).
 */
class TokenIntegrasi
{
    public function handle(Request $request, Closure $next, string $sistem = 'kandang_suite'): Response
    {
        $token = (string) config("integrasi.{$sistem}.token");

        if ($token === '') {
            return response()->json(['pesan' => 'Integrasi belum diaktifkan.'], 503);
        }

        if (! hash_equals($token, (string) $request->bearerToken())) {
            return response()->json(['pesan' => 'Token tidak valid.'], 401);
        }

        return $next($request);
    }
}
