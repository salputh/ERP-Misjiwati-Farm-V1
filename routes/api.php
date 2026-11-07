<?php

use App\Http\Controllers\IntegrasiSampelController;
use Illuminate\Support\Facades\Route;

/*
 * Pintu integrasi untuk sistem lain. Diawali /api, dilindungi token (middleware token.integrasi).
 */
Route::middleware(['token.integrasi:kandang_suite', 'throttle:60,1'])->group(function (): void {
    Route::post('/integrasi/sampel', [IntegrasiSampelController::class, 'simpan'])->name('integrasi.sampel');
});
