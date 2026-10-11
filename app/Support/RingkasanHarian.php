<?php

namespace App\Support;

use App\Models\Periode;
use App\Models\PeriodeKandang;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Isi "Laporan Harian" satu periode pada satu tanggal: pakan masuk, opname pakan per jenis,
 * serta mortalitas, ABW, dan FCR tiap kandang. Semua angka dihitung sampai tanggal laporan.
 */
class RingkasanHarian
{
    /**
     * Tanggal terakhir yang punya catatan (pakan atau recording) pada periode ini.
     */
    public static function tanggalTerakhir(Periode $periode): ?CarbonInterface
    {
        return $periode->kandangPeriode
            ->flatMap(fn (PeriodeKandang $kandang) => $kandang->pemberianPakan->pluck('tanggal')->merge($kandang->recordings->pluck('tanggal')))
            ->merge($periode->penerimaanPakan->pluck('tanggal'))
            ->max();
    }

    /**
     * Pakai relasi kandangPeriode (kandang, recordings, pemberianPakan.jenisPakan) dan penerimaanPakan.jenisPakan yang sudah di-load.
     *
     * @return array{tanggal: CarbonInterface, umur: int, populasi: int, pakan_masuk: list<array<string, mixed>>, total_pakan_masuk: float, opname: list<array<string, mixed>>, total_opname: array<string, float>, hari_cukup: ?float, kandang: list<array<string, mixed>>, total: array<string, mixed>, catatan: list<array<string, mixed>>}
     */
    public static function buat(Periode $periode, CarbonInterface $tanggal): array
    {
        $umur = $periode->umurPada($tanggal);
        $kandang = $periode->kandangPeriode
            ->sortBy('kandang.nama')
            ->map(fn (PeriodeKandang $periodeKandang): array => self::kandang($periodeKandang->setRelation('periode', $periode), $umur))
            ->values();

        $opname = self::opname($periode, $tanggal);
        $sisa = $opname->whereNotNull('sisa')->isEmpty() ? null : (float) $opname->sum('sisa');
        $terpakaiHariIni = (float) $opname->sum('terpakai_hari_ini');
        $bobotHidup = $kandang->sum(fn (array $k) => $k['abw'] ? $k['sisa'] * $k['abw'] : 0);

        return [
            'tanggal' => $tanggal,
            'umur' => $umur,
            'populasi' => (int) $kandang->sum('populasi'),
            'pakan_masuk' => $periode->penerimaanPakan
                ->filter(fn ($penerimaan) => $penerimaan->tanggal->lte($tanggal))
                ->map(fn ($penerimaan): array => ['tanggal' => $penerimaan->tanggal, 'jenis' => $penerimaan->jenisPakan->kode, 'zak' => $penerimaan->zak])
                ->values()
                ->all(),
            'total_pakan_masuk' => (float) $opname->sum('masuk'),
            'opname' => $opname->all(),
            'total_opname' => [
                'masuk' => (float) $opname->sum('masuk'),
                'terpakai_hari_ini' => $terpakaiHariIni,
                'terpakai' => (float) $opname->sum('terpakai'),
                'sisa' => $sisa,
            ],
            'hari_cukup' => $terpakaiHariIni > 0 && $sisa > 0 ? $sisa / $terpakaiHariIni : null,
            'kandang' => $kandang->all(),
            'total' => [
                'populasi' => (int) $kandang->sum('populasi'),
                'mati_hari_ini' => (int) $kandang->sum('mati_hari_ini'),
                'mati_kumulatif' => (int) $kandang->sum('mati_kumulatif'),
                'mortalitas' => $kandang->sum('populasi') ? $kandang->sum('mati_kumulatif') / $kandang->sum('populasi') * 100 : 0.0,
                'sisa' => (int) $kandang->sum('sisa'),
                // ABW dan FCR gabungan ditimbang jumlah ayam (dan bobot hidup) tiap kandang.
                'abw' => $bobotHidup ? $bobotHidup / $kandang->sum(fn (array $k) => $k['abw'] ? $k['sisa'] : 0) : null,
                'fcr' => $bobotHidup ? $kandang->sum(fn (array $k) => $k['fcr'] ? $k['fcr'] * $k['sisa'] * $k['abw'] : 0) / $bobotHidup : null,
            ],
            'catatan' => $periode->kandangPeriode
                ->flatMap(fn (PeriodeKandang $periodeKandang) => $periodeKandang->recordings
                    ->filter(fn ($rekam) => filled($rekam->catatan) && $rekam->umur <= $umur)
                    ->map(fn ($rekam): array => ['kandang' => $periodeKandang->kandang->nama, 'tanggal' => $rekam->tanggal, 'catatan' => $rekam->catatan]))
                ->sortBy('tanggal')
                ->values()
                ->all(),
        ];
    }

    /**
     * Mortalitas, ABW, dan FCR satu kandang sampai umur laporan.
     *
     * @return array<string, mixed>
     */
    private static function kandang(PeriodeKandang $periodeKandang, int $umur): array
    {
        $rekaman = $periodeKandang->recordings->where('umur', '<=', $umur);
        $hariIni = $rekaman->firstWhere('umur', $umur);
        $matiKumulatif = (int) $rekaman->sum(fn ($rekam) => $rekam->mati + $rekam->afkir);
        $timbang = collect(LembarRecording::baris($periodeKandang))
            ->filter(fn (array $hari): bool => $hari['umur'] <= $umur && isset($hari['abw']))
            ->last();

        return [
            'nama' => $periodeKandang->kandang->nama,
            'populasi' => $periodeKandang->populasi_awal,
            'mati_hari_ini' => (int) ($hariIni?->mati + $hariIni?->afkir),
            'mati_kumulatif' => $matiKumulatif,
            'mortalitas' => $matiKumulatif / $periodeKandang->populasi_awal * 100,
            'sisa' => $periodeKandang->populasi_awal - $matiKumulatif,
            'abw' => $timbang['abw'] ?? null,
            'abw_umur' => $timbang['umur'] ?? null,
            'abw_standar' => $timbang['abw_standar'] ?? null,
            'abw_selisih' => $timbang ? $timbang['abw_persen_standar'] - 100 : null,
            'fcr' => $timbang['fcr'] ?? null,
            'fcr_standar' => $timbang['fcr_standar'] ?? null,
        ];
    }

    /**
     * Stok pakan per jenis: masuk, terpakai hari ini, terpakai sampai hari ini, dan sisa.
     * Terpakai diambil dari log pemberian pakan. Pemberian tanpa jenis dikumpulkan di baris tersendiri.
     * Tanpa tanggal, semua catatan periode dihitung.
     *
     * @return Collection<int, array{jenis: string, masuk: ?float, terpakai_hari_ini: float, terpakai: float, sisa: ?float, persen_terpakai: ?float}>
     */
    public static function opname(Periode $periode, ?CarbonInterface $tanggal = null): Collection
    {
        $tanpaJenis = 'Jenis belum dicatat';

        $masuk = $periode->penerimaanPakan
            ->filter(fn ($penerimaan) => ! $tanggal || $penerimaan->tanggal->lte($tanggal))
            ->groupBy(fn ($penerimaan) => $penerimaan->jenisPakan->kode)
            ->map->sum('zak');

        $pemberian = $periode->kandangPeriode
            ->flatMap->pemberianPakan
            ->filter(fn ($beri) => ! $tanggal || $beri->tanggal->lte($tanggal))
            ->groupBy(fn ($beri) => $beri->jenisPakan?->kode ?? $tanpaJenis);

        return $masuk->keys()->merge($pemberian->keys())->unique()
            ->sortBy(fn (string $jenis) => [$jenis === $tanpaJenis, $jenis])
            ->values()
            ->map(function (string $jenis) use ($masuk, $pemberian, $tanggal, $tanpaJenis): array {
                $jumlahMasuk = (float) $masuk->get($jenis, 0);
                $terpakai = (float) $pemberian->get($jenis, collect())->sum('zak');

                // Pemberian tanpa jenis tidak bisa dicocokkan dengan pakan masuk, jadi stoknya tidak dihitung.
                $bisaDihitung = $jenis !== $tanpaJenis;

                return [
                    'jenis' => $jenis,
                    'masuk' => $bisaDihitung ? $jumlahMasuk : null,
                    'terpakai_hari_ini' => (float) $pemberian->get($jenis, collect())->filter(fn ($beri) => $tanggal && $beri->tanggal->isSameDay($tanggal))->sum('zak'),
                    'terpakai' => $terpakai,
                    'sisa' => $bisaDihitung ? $jumlahMasuk - $terpakai : null,
                    'persen_terpakai' => $bisaDihitung && $jumlahMasuk > 0 ? min(100, $terpakai / $jumlahMasuk * 100) : null,
                ];
            });
    }
}
