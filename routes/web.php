<?php

use App\Http\Controllers\PanenExportController;
use App\Http\Controllers\RecordingHarianExportController;
use App\Http\Controllers\TemplateController;
use App\Livewire\BagiHasil;
use App\Livewire\Dashboard;
use App\Livewire\DataKaryawan;
use App\Livewire\FormLaporanHarian;
use App\Livewire\KasOperasional;
use App\Livewire\LaporanHarian;
use App\Livewire\LogPemberianPakan;
use App\Livewire\MasterData;
use App\Livewire\Modul;
use App\Livewire\Panen;
use App\Livewire\PayrollAbk;
use App\Livewire\PayrollPemanen;
use App\Livewire\RecordingHarian;
use App\Livewire\Rhpp;
use App\Livewire\RiwayatAktivitas;
use App\Livewire\SamplingBobot;
use App\Models\Kandang;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard');
Route::get('/dashboard', Dashboard::class)->name('dashboard');
Route::get('/aktivitas', RiwayatAktivitas::class)->name('aktivitas');
Route::get('/produksi/recording-harian', RecordingHarian::class)->name('recording.harian');
Route::get('/produksi/recording-harian/{periodeKandang}/export/{format}', RecordingHarianExportController::class)
    ->whereIn('format', ['pdf', 'xlsx'])
    ->name('recording.harian.export');
Route::get('/produksi/laporan-harian', LaporanHarian::class)->name('laporan.harian');
Route::get('/produksi/laporan-harian/form', FormLaporanHarian::class)->name('laporan.harian.form');
Route::get('/produksi/pakan-dan-stok', LogPemberianPakan::class)->name('pakan.log');
Route::get('/produksi/sampling-bobot', SamplingBobot::class)->name('sampling.bobot');
Route::get('/produksi/panen', Panen::class)->name('panen.rekap');
Route::get('/produksi/panen/{periode}/export/{hari?}', PanenExportController::class)
    ->whereNumber('periode')
    ->whereNumber('hari')
    ->name('panen.export');
Route::get('/keuangan/rhpp', Rhpp::class)->name('rhpp');
// Kas operasional dan bagi hasil dibuka per kandang; tanpa kandang diarahkan ke kandang pertama.
Route::get('/keuangan/kas-operasional', fn () => to_route('kas.operasional', Kandang::orderBy('nama')->firstOrFail()));
Route::get('/keuangan/kas-operasional/{kandang}', KasOperasional::class)->name('kas.operasional');
Route::get('/keuangan/bagi-hasil', fn () => to_route('bagi.hasil', Kandang::orderBy('nama')->firstOrFail()));
Route::get('/keuangan/bagi-hasil/{kandang}', BagiHasil::class)->name('bagi.hasil');
Route::get('/keuangan/payroll-abk', PayrollAbk::class)->name('payroll.abk');
Route::get('/keuangan/payroll-pemanen', PayrollPemanen::class)->name('payroll.pemanen');
Route::get('/master', MasterData::class)->name('master-data');
Route::get('/master/jenis-pakan', fn () => to_route('master-data'))->name('jenis-pakan');
Route::get('/master/harga-kontrak', fn () => to_route('master-data', request()->only('periode')))->name('harga-kontrak');
Route::get('/master/pemodal', fn () => to_route('master-data'))->name('pemodal');
Route::get('/master/karyawan', DataKaryawan::class)->name('karyawan');

// Katalog halaman contoh template, hanya di lingkungan pengembangan.
if (app()->environment('local', 'testing')) {
    Route::get('/template', [TemplateController::class, 'index'])->name('template.index');
    Route::get('/template/{halaman}', [TemplateController::class, 'show'])->where('halaman', '.*')->name('template.halaman');
}

Route::get('/{grup}/{slug}', Modul::class)->name('modul');
