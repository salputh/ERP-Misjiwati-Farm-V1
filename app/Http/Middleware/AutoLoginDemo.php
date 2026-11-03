<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dalam demo mode, langsung masukkan user demo secara otomatis tanpa perlu login.
 * Pengunjung portfolio tidak perlu tahu kredensial — langsung bisa eksplorasi fitur.
 */
class AutoLoginDemo
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.demo_mode', false)) {
            return $next($request);
        }

        // Jika belum login, auto-login sebagai user demo
        if (! Auth::check()) {
            $email = config('app.demo_credentials.username', 'demo@misjiwatifarm.tech');
            $user = User::where('email', $email)->first();

            if ($user) {
                Auth::login($user, remember: true);
                $request->session()->regenerate();
            }
        }

        // Jika ada yang mencoba akses /masuk atau root /, redirect ke dashboard
        if ($request->routeIs('login') || $request->is('/')) {
            return redirect()->route('dashboard');
        }

        return $next($request);
    }
}
