<?php

namespace App\Http\Controllers;

use App\Exports\RecordingHarianExport;
use App\Models\PeriodeKandang;
use App\Support\LembarRecording;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

class RecordingHarianExportController extends Controller
{
    public function __invoke(PeriodeKandang $periodeKandang, string $format): Response
    {
        $periodeKandang->load(['kandang', 'periode', 'recordings', 'pemberianPakan']);

        $baris = LembarRecording::baris($periodeKandang);
        $namaBerkas = Str::slug("recording-harian-{$periodeKandang->kandang->nama}-{$periodeKandang->periode->nama}");

        return match ($format) {
            'pdf' => Pdf::loadView('exports.recording-harian', [
                'periodeKandang' => $periodeKandang,
                'baris' => $baris,
                'kolom' => RecordingHarianExport::kolom(),
            ])->setPaper('a3', 'landscape')->download("{$namaBerkas}.pdf"),
            'xlsx' => Excel::download(new RecordingHarianExport($baris), "{$namaBerkas}.xlsx"),
            default => abort(404),
        };
    }
}
