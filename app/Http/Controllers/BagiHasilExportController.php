<?php

namespace App\Http\Controllers;

use App\Models\Kandang;
use App\Models\Periode;
use App\Support\BukuKas;
use App\Support\LembarBagiHasil;
use App\Support\LembarRhpp;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class BagiHasilExportController extends Controller
{
    public function __invoke(Kandang $kandang, Periode $periode): Response
    {
        abort_unless($kandang->farm_id === $periode->farm_id, 404);

        $periodeKandang = $periode->kandangPeriode()
            ->where('kandang_id', $kandang->id)
            ->with(['bagiHasil.penerima', 'transaksiKas', 'kandang'])
            ->firstOrFail();

        $lembar = LembarBagiHasil::buat(
            $periodeKandang,
            LembarRhpp::real($periode->loadMissing(LembarRhpp::RELASI)),
            BukuKas::buat($periodeKandang),
        );

        abort_if($lembar === null, 404);

        $namaBerkas = Str::slug("bagi-hasil-{$kandang->nama}-{$periode->nama}");

        return Pdf::loadView('exports.bagi-hasil', [
            'periode' => $periode,
            'kandang' => $kandang,
            'lembar' => $lembar,
        ])->setPaper('a4', 'portrait')->download("{$namaBerkas}.pdf");
    }
}
