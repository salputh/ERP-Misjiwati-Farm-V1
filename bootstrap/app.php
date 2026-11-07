<?php

use App\Http\Middleware\AutoLoginDemo;
use App\Http\Middleware\DemoMode;
use App\Http\Middleware\TokenIntegrasi;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['token.integrasi' => TokenIntegrasi::class]);

        // Demo mode: pengunjung langsung masuk sebagai user demo.
        $middleware->web(append: [
            AutoLoginDemo::class,
            DemoMode::class,
        ]);
        $middleware->prependToPriorityList(
            before: AuthenticatesRequests::class,
            prepend: AutoLoginDemo::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
