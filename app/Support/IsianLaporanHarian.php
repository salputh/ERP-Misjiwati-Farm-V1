<?php

namespace App\Support;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\JenisPakan;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Isian laporan harian satu periode pada satu tanggal: pakan masuk, dan untuk tiap kandang kematian, afkir,
 * ABW, pakan yang diberikan, dan catatan. Datanya tersimpan sebagai penerimaan pakan, recording, dan
 * pemberian pakan, jadi halaman laporan harian, recording, dan pakan ikut berubah.
 *
 * Kunci isian form: "j{id}" untuk jenis pakan, "k{id}" untuk kandang periode.
 */
class IsianLaporanHarian
{
    /** Kunci pakan yang jenisnya belum dicatat (data lama). */
    public const TANPA_JENIS = 'tanpa';

    /**
     * Tanggal yang sudah punya laporan, terbaru dulu, dengan ringkasan isinya.
     * Pakai relasi kandangPeriode (recordings, pemberianPakan) dan penerimaanPakan yang sudah di-load.
     *
     * @return list<array{tanggal: CarbonInterface, umur: int, kematian: ?int, pakan_terpakai: float, pakan_masuk: float, abw: ?float}>
     */
    public static function daftar(Periode $periode): array
    {
        $perTanggal = fn (Collection $catatan): Collection => $catatan->groupBy(fn (Model $satu): string => $satu->tanggal->toDateString());

        $recording = $perTanggal($periode->kandangPeriode->flatMap->recordings);
        $pemberian = $perTanggal($periode->kandangPeriode->flatMap->pemberianPakan);
        $masuk = $perTanggal($periode->penerimaanPakan);

        return $recording->keys()->merge($pemberian->keys())->merge($masuk->keys())
            ->unique()
            ->sortDesc()
            ->values()
            ->map(function (string $tanggal) use ($periode, $recording, $pemberian, $masuk): array {
                $hari = Carbon::parse($tanggal);
                $rekaman = $recording->get($tanggal, collect());

                return [
                    'tanggal' => $hari,
                    'umur' => $periode->umurPada($hari),
                    // Null berarti kematian belum dicatat pada tanggal itu, bukan nol.
                    'kematian' => $rekaman->isEmpty() ? null : (int) $rekaman->sum(fn (Recording $satu): int => $satu->mati + $satu->afkir),
                    'pakan_terpakai' => (float) $pemberian->get($tanggal, collect())->sum('zak'),
                    'pakan_masuk' => (float) $masuk->get($tanggal, collect())->sum('zak'),
                    'abw' => $rekaman->whereNotNull('bobot_rata_gram')->avg('bobot_rata_gram'),
                ];
            })
            ->all();
    }

    public static function ada(Periode $periode, CarbonInterface $tanggal): bool
    {
        $kandang = $periode->kandangPeriode()->pluck('id');

        return Recording::whereIn('periode_kandang_id', $kandang)->whereDate('tanggal', $tanggal)->exists()
            || PemberianPakan::whereIn('periode_kandang_id', $kandang)->whereDate('tanggal', $tanggal)->exists()
            || $periode->penerimaanPakan()->whereDate('tanggal', $tanggal)->exists();
    }

    /**
     * Isi form untuk satu tanggal: nilai tersimpan sebagai teks, kosong bila belum dicatat.
     * Isian pakan tanpa jenis hanya ada bila tanggal itu memang punya data seperti itu.
     *
     * @param  Collection<int, JenisPakan>  $jenisPakan
     * @return array{masuk: array<string, string>, isian: array<string, array{mati: string, afkir: string, abw: string, catatan: string, pakan: array<string, string>}>}
     */
    public static function muat(Periode $periode, CarbonInterface $tanggal, Collection $jenisPakan): array
    {
        $penerimaan = $periode->penerimaanPakan()->whereDate('tanggal', $tanggal)->get();
        $masuk = $jenisPakan->mapWithKeys(fn (JenisPakan $jenis): array => [
            'j'.$jenis->id => self::teks($penerimaan->where('jenis_pakan_id', $jenis->id)->sum('zak')),
        ])->all();

        $isian = $periode->kandangPeriode()->get()->mapWithKeys(function (PeriodeKandang $kandang) use ($tanggal, $jenisPakan): array {
            $rekaman = $kandang->recordings()->whereDate('tanggal', $tanggal)->first();
            $pemberian = $kandang->pemberianPakan()->whereDate('tanggal', $tanggal)->get();

            $pakan = $jenisPakan->mapWithKeys(fn (JenisPakan $jenis): array => [
                'j'.$jenis->id => self::teks($pemberian->where('jenis_pakan_id', $jenis->id)->sum('zak')),
            ])->all();
            $tanpaJenis = (float) $pemberian->whereNull('jenis_pakan_id')->sum('zak');
            if ($tanpaJenis > 0) {
                $pakan[self::TANPA_JENIS] = self::teks($tanpaJenis);
            }

            return ['k'.$kandang->id => [
                'mati' => $rekaman ? (string) $rekaman->mati : '',
                'afkir' => $rekaman ? (string) $rekaman->afkir : '',
                'abw' => self::teks($rekaman?->bobot_rata_gram),
                'catatan' => (string) $rekaman?->catatan,
                'pakan' => $pakan,
            ]];
        })->all();

        return ['masuk' => $masuk, 'isian' => $isian];
    }

    /**
     * Simpan isian yang sudah divalidasi. Isian kosong berarti belum dicatat: recording kandang hanya dibuat bila
     * kematian, afkir, ABW, atau catatannya diisi, dan pakan hanya dicatat bila lebih dari nol.
     * Riwayat aktivitas mencatatnya sebagai laporan baru atau perubahan, tergantung tanggal itu sudah punya laporan atau belum.
     *
     * @param  array<string, mixed>  $masuk
     * @param  array<string, array<string, mixed>>  $isian
     */
    public static function simpan(Periode $periode, CarbonInterface $tanggal, array $masuk, array $isian): void
    {
        $tanggal = Carbon::parse($tanggal->toDateString());
        $umur = $periode->umurPada($tanggal);

        DB::transaction(function () use ($periode, $tanggal, $umur, $masuk, $isian): void {
            $jenis = self::ada($periode, $tanggal) ? JenisAktivitas::Ubah : JenisAktivitas::Tambah;

            $periode->penerimaanPakan()->whereDate('tanggal', $tanggal)->delete();
            foreach ($masuk as $kunci => $zak) {
                if ((float) $zak > 0) {
                    PenerimaanPakan::create(['periode_id' => $periode->id, 'jenis_pakan_id' => (int) substr($kunci, 1), 'tanggal' => $tanggal, 'zak' => (float) $zak]);
                }
            }

            foreach ($periode->kandangPeriode()->get() as $kandang) {
                $satu = $isian['k'.$kandang->id] ?? [];
                $rekaman = $kandang->recordings()->whereDate('tanggal', $tanggal)->first();

                if (collect($satu)->only(['mati', 'afkir', 'abw', 'catatan'])->filter(fn (mixed $nilai): bool => filled($nilai))->isNotEmpty()) {
                    ($rekaman ?? new Recording(['periode_kandang_id' => $kandang->id, 'tanggal' => $tanggal]))->fill([
                        'umur' => $umur,
                        'mati' => (int) ($satu['mati'] ?? 0),
                        'afkir' => (int) ($satu['afkir'] ?? 0),
                        'bobot_rata_gram' => filled($satu['abw'] ?? null) ? (float) $satu['abw'] : null,
                        'catatan' => filled($satu['catatan'] ?? null) ? trim($satu['catatan']) : null,
                    ])->save();
                } else {
                    $rekaman?->delete();
                }

                $kandang->pemberianPakan()->whereDate('tanggal', $tanggal)->delete();
                foreach ($satu['pakan'] ?? [] as $kunci => $zak) {
                    if ((float) $zak > 0) {
                        PemberianPakan::create([
                            'periode_kandang_id' => $kandang->id,
                            'jenis_pakan_id' => $kunci === self::TANPA_JENIS ? null : (int) substr($kunci, 1),
                            'tanggal' => $tanggal,
                            'umur' => $umur,
                            'zak' => (float) $zak,
                        ]);
                    }
                }
            }

            self::catat($jenis, $periode, $tanggal);
        });
    }

    /**
     * Hapus seluruh catatan periode pada tanggal itu. Mengembalikan jumlah baris yang terhapus.
     * Riwayat aktivitas hanya mencatatnya bila memang ada yang terhapus.
     */
    public static function hapus(Periode $periode, CarbonInterface $tanggal): int
    {
        $kandang = $periode->kandangPeriode()->pluck('id');

        return DB::transaction(function () use ($periode, $tanggal, $kandang): int {
            $terhapus = Recording::whereIn('periode_kandang_id', $kandang)->whereDate('tanggal', $tanggal)->delete()
                + PemberianPakan::whereIn('periode_kandang_id', $kandang)->whereDate('tanggal', $tanggal)->delete()
                + $periode->penerimaanPakan()->whereDate('tanggal', $tanggal)->delete();

            if ($terhapus > 0) {
                self::catat(JenisAktivitas::Hapus, $periode, $tanggal);
            }

            return $terhapus;
        });
    }

    private static function catat(JenisAktivitas $jenis, Periode $periode, CarbonInterface $tanggal): void
    {
        Aktivitas::catat(
            $jenis,
            ModulAktivitas::LaporanHarian,
            'Laporan harian '.$tanggal->translatedFormat('j F Y'),
            "{$periode->nama}, umur {$periode->umurPada($tanggal)} hari",
        );
    }

    /**
     * Angka sebagai isi form: kosong untuk null atau nol, tanpa nol di belakang koma (9, 394.8).
     */
    private static function teks(int|float|null $nilai): string
    {
        return $nilai ? rtrim(rtrim(number_format($nilai, 1, '.', ''), '0'), '.') : '';
    }
}
