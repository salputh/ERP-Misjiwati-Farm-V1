<?php

namespace App\Support;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\PeriodeKandang;
use App\Models\SesiSampling;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Menyimpan sampling bobot kiriman Kandang Suite sebagai sesi sampling ERP.
 *
 * Yang dikirim hanya isian mentah (berat dan ekor per titik). Umur, ABW, DG, dan semua hasil
 * lain dihitung ERP sendiri dari data tersebut, persis seperti sampling yang diisi di ERP.
 */
class ImporSampelKandangSuite
{
    /**
     * @param  array{idEksternal: string, kandang: string, tanggal: string, jenis: string, titik: list<array{lantai: string, kelamin: string, line: string, urutan: int, beratGram: int, ekor: int}>}  $data
     * @return array{status: int, isi: array<string, mixed>}
     */
    public function simpan(array $data): array
    {
        $kandang = Kandang::query()->where('nama', $data['kandang'])->first();
        if (! $kandang) {
            return $this->tolak(422, "Kandang '{$data['kandang']}' tidak dikenal di ERP.");
        }

        $periodeKandang = $this->periodeKandang($kandang, Carbon::parse($data['tanggal']));
        if (! $periodeKandang) {
            return $this->tolak(422, "Tidak ada periode yang sedang berjalan untuk {$kandang->nama} pada {$data['tanggal']}.");
        }

        $chickIn = $periodeKandang->tanggalChickInEfektif();
        $tanggal = Carbon::parse($data['tanggal'])->startOfDay();
        $standar = new Standar($periodeKandang->periode->strain, (float) $periodeKandang->beratDocGramEfektif());
        $umurMaksimal = $standar->umurMaksimal();
        $umur = (int) $chickIn->diffInDays($tanggal, false);
        if ($umur < 0 || $umur > $umurMaksimal) {
            return $this->tolak(422, 'Tanggal harus antara '.$chickIn->format('Y-m-d').' dan '.$chickIn->copy()->addDays($umurMaksimal)->format('Y-m-d').'.');
        }

        $denganSexing = $data['jenis'] === 'sexing';
        $masalah = $this->periksaTitik($data['titik'], $kandang->nama, $denganSexing);
        if ($masalah !== []) {
            return $this->tolak(422, 'Data sampel belum lengkap atau tidak sesuai susunan '.$kandang->nama.'.', $masalah);
        }

        $sesiAda = SesiSampling::query()
            ->where('periode_kandang_id', $periodeKandang->id)
            ->whereDate('tanggal', $tanggal)
            ->first();

        if ($sesiAda && $sesiAda->id_eksternal !== $data['idEksternal']) {
            return $this->tolak(409, "{$kandang->nama} sudah punya sampling tanggal {$data['tanggal']} di ERP. Data ERP tidak ditimpa.");
        }

        $sesi = DB::transaction(function () use ($sesiAda, $periodeKandang, $tanggal, $umur, $denganSexing, $data, $kandang): SesiSampling {
            $sesi = $sesiAda ?? new SesiSampling(['periode_kandang_id' => $periodeKandang->id, 'tanggal' => $tanggal]);
            $sesi->fill(['umur' => $umur, 'dengan_sexing' => $denganSexing, 'id_eksternal' => $data['idEksternal']])->save();

            $sesi->titik()->delete();
            foreach ($data['titik'] as $titik) {
                $sesi->titik()->create([
                    'lantai' => $titik['lantai'],
                    'line' => $titik['line'],
                    'kelamin' => $titik['kelamin'],
                    'urutan' => $titik['urutan'],
                    'berat_gram' => $titik['beratGram'],
                    'ekor' => $titik['ekor'],
                ]);
            }

            Aktivitas::catat(
                $sesiAda ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::SamplingBobot,
                'Sampling bobot '.$tanggal->translatedFormat('j F Y'),
                "{$kandang->nama} (dikirim dari Kandang Suite)",
            );

            return $sesi;
        });

        return [
            'status' => $sesiAda ? 200 : 201,
            'isi' => ['pesan' => $sesiAda ? 'Sampling diperbarui.' : 'Sampling tersimpan.', 'id' => $sesi->id, 'umur' => $umur],
        ];
    }

    /**
     * Periode kandang yang belum ditutup dan sudah chick-in pada tanggal itu; bila ada beberapa, yang chick-in-nya terbaru.
     */
    private function periodeKandang(Kandang $kandang, Carbon $tanggal): ?PeriodeKandang
    {
        return PeriodeKandang::query()
            ->with('periode')
            ->where('kandang_id', $kandang->id)
            ->get()
            ->filter(fn (PeriodeKandang $pk): bool => ! $pk->periode->tertutup() && $pk->tanggalChickInEfektif()->startOfDay()->lte($tanggal))
            ->sortByDesc(fn (PeriodeKandang $pk): string => $pk->tanggalChickInEfektif()->format('Y-m-d'))
            ->first();
    }

    /**
     * Cocokkan titik kiriman dengan susunan kandang: semua titik ada, tidak ada yang kelebihan atau kembar,
     * dan ekor sama untuk semua titik satu kelamin (satu angka ekor per sampel).
     *
     * @param  list<array{lantai: string, kelamin: string, line: string, urutan: int, beratGram: int, ekor: int}>  $titik
     * @return list<string>
     */
    private function periksaTitik(array $titik, string $namaKandang, bool $denganSexing): array
    {
        $diharapkan = [];
        foreach (SusunanSampling::untuk($namaKandang) as $lantai => $info) {
            foreach (HasilSampling::kelamin($denganSexing) as $kelamin) {
                foreach ($info['line'] as $line) {
                    for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                        $diharapkan["{$lantai}|{$kelamin}|{$line}|{$urutan}"] = true;
                    }
                }
            }
        }

        $masalah = [];
        $diterima = [];
        $ekorPerKelamin = [];
        foreach ($titik as $baris) {
            $kunci = "{$baris['lantai']}|{$baris['kelamin']}|{$baris['line']}|{$baris['urutan']}";
            if (isset($diterima[$kunci])) {
                $masalah[] = "Titik kembar: {$this->label($baris)}.";
            } elseif (! isset($diharapkan[$kunci])) {
                $masalah[] = "Titik tidak ada di susunan {$namaKandang}: {$this->label($baris)}.";
            }
            $diterima[$kunci] = true;
            $ekorPerKelamin[$baris['kelamin']][$baris['ekor']] = true;
        }

        foreach (array_keys($diharapkan) as $kunci) {
            if (! isset($diterima[$kunci])) {
                [$lantai, $kelamin, $line, $urutan] = explode('|', $kunci);
                $masalah[] = "Belum diisi: {$this->label(compact('lantai', 'kelamin', 'line', 'urutan'))}.";
            }
        }

        foreach ($ekorPerKelamin as $kelamin => $nilai) {
            if (count($nilai) > 1) {
                $masalah[] = "Jumlah ekor {$kelamin} harus sama untuk semua titik.";
            }
        }

        return array_slice($masalah, 0, 20);
    }

    /**
     * @param  array<string, mixed>  $baris
     */
    private function label(array $baris): string
    {
        return "lantai {$baris['lantai']}, {$baris['kelamin']}, line {$baris['line']}, sampel {$baris['urutan']}";
    }

    /**
     * @param  list<string>  $rincian
     * @return array{status: int, isi: array<string, mixed>}
     */
    private function tolak(int $status, string $pesan, array $rincian = []): array
    {
        return ['status' => $status, 'isi' => array_filter(['pesan' => $pesan, 'rincian' => $rincian])];
    }
}
