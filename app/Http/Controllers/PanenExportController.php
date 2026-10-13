<?php

namespace App\Http\Controllers;

use App\Models\Periode;
use App\Support\RekapPanen;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class PanenExportController extends Controller
{
    public function __invoke(Periode $periode, ?int $hari = null): Response
    {
        $periode->load([
            'notaPanen',
            'kandangPeriode.recordings',
            'kandangPeriode.pemberianPakan.jenisPakan',
        ]);

        $rekap = RekapPanen::buat($periode);
        abort_if($rekap === null, 404);

        $sesi = $hari === null
            ? null
            : collect($rekap['hari'])->firstWhere('nomor', $hari);
        abort_if($hari !== null && $sesi === null, 404);

        $namaRuangLingkup = $sesi ? 'hari-'.$sesi['nomor'] : 'semua';
        $namaBerkas = Str::slug("nota-panen-{$periode->nama}-{$namaRuangLingkup}");

        return Pdf::loadView('exports.panen', [
            'periode' => $periode,
            'hari' => $sesi,
            'daftarHari' => $sesi ? [$sesi] : $rekap['hari'],
            'total' => $rekap['total'],
        ])->setPaper('a3', 'landscape')->download("{$namaBerkas}.pdf");
    }
}
