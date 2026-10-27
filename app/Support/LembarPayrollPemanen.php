<?php

namespace App\Support;

use App\Enums\Jabatan;
use App\Models\Karyawan;
use App\Models\NotaPanen;
use App\Models\Pemanen;
use App\Models\Periode;

/**
 * Lembar payroll pemanen: tonase tiap pemanen terdaftar dikali tarifnya, ditambah tonase yang belum dapat dihitung
 * (nama pemanen belum terdaftar di Master Data atau berat yang belum teralokasi ke nama).
 * ABK yang ikut memanen tidak dibayar di sini; tonasenya dicatat terpisah.
 */
class LembarPayrollPemanen
{
    /**
     * Upah pemanen satu periode dari nota panen dan tarif Master Data. Null bila periode belum punya nota panen.
     *
     * @return array{
     *     jumlah_nota: int,
     *     berat_total: float,
     *     berat_teralokasi: float,
     *     berat_nama_belum_terdaftar: float,
     *     berat_abk: float,
     *     berat_tanpa_nama: float,
     *     total_upah: int,
     *     pemanen: list<array{id: int, nama: string, jumlah_nota: int, berat_kg: float, upah_per_kg: int, total_upah: int}>,
     *     nama_belum_terdaftar: list<array{nama: string, berat_kg: float}>,
     *     abk: list<array{nama: string, berat_kg: float}>
     * }|null
     */
    public static function buat(Periode $periode): ?array
    {
        $notas = $periode->notaPanen()->with('pemanenKrat')->orderBy('mulai')->get();
        if ($notas->isEmpty()) {
            return null;
        }

        $pemanen = Pemanen::query()->orderBy('nama')->get();
        $pemanenMenurutNama = $pemanen->keyBy(fn (Pemanen $orang): string => mb_strtolower(trim($orang->nama)));
        $namaKaryawanAbk = self::namaKaryawanAbk();
        $beratPerPemanen = [];
        $beratNamaBelumTerdaftar = [];
        $beratAbk = [];
        $beratTanpaNama = 0;
        $beratTotal = 0;

        foreach ($notas as $nota) {
            $beratTotal += (int) round((float) $nota->berat_kg * 100);
            $alokasi = self::alokasiNota($nota);
            $beratTanpaNama += $alokasi['tanpa_nama'];

            // Satu nama dihitung sekali per nota walau tercatat di beberapa rentang krat.
            $beratPerNamaDiNota = [];
            foreach ($alokasi['rentang'] as $rentang) {
                $namaKunci = mb_strtolower($rentang['nama']);
                $beratPerNamaDiNota[$namaKunci] ??= ['nama' => $rentang['nama'], 'berat' => 0];
                $beratPerNamaDiNota[$namaKunci]['berat'] += $rentang['berat'];
            }

            foreach ($beratPerNamaDiNota as $namaKunci => $orang) {
                if (self::abk($orang['nama'], $namaKaryawanAbk)) {
                    $beratAbk[$namaKunci] ??= ['nama' => $orang['nama'], 'berat' => 0];
                    $beratAbk[$namaKunci]['berat'] += $orang['berat'];

                    continue;
                }

                $pemanenTerdaftar = $pemanenMenurutNama->get($namaKunci);

                if ($pemanenTerdaftar) {
                    $beratPerPemanen[$pemanenTerdaftar->id] ??= [
                        'nama' => $pemanenTerdaftar->nama,
                        'jumlah_nota' => 0,
                        'berat' => 0,
                        'upah_per_kg' => (int) $pemanenTerdaftar->upah_per_kg,
                    ];
                    $beratPerPemanen[$pemanenTerdaftar->id]['jumlah_nota']++;
                    $beratPerPemanen[$pemanenTerdaftar->id]['berat'] += $orang['berat'];

                    continue;
                }

                $beratNamaBelumTerdaftar[$namaKunci] ??= ['nama' => $orang['nama'], 'berat' => 0];
                $beratNamaBelumTerdaftar[$namaKunci]['berat'] += $orang['berat'];
            }
        }

        $barisPemanen = collect($beratPerPemanen)
            ->map(fn (array $orang, int $id): array => [
                'id' => $id,
                'nama' => $orang['nama'],
                'jumlah_nota' => $orang['jumlah_nota'],
                'berat_kg' => $orang['berat'] / 100,
                'upah_per_kg' => $orang['upah_per_kg'],
                'total_upah' => (int) round($orang['berat'] * $orang['upah_per_kg'] / 100),
            ])
            ->sortBy('nama')
            ->values();

        return [
            'jumlah_nota' => $notas->count(),
            'berat_total' => $beratTotal / 100,
            'berat_teralokasi' => (float) $barisPemanen->sum('berat_kg'),
            'berat_nama_belum_terdaftar' => array_sum(array_column($beratNamaBelumTerdaftar, 'berat')) / 100,
            'berat_abk' => array_sum(array_column($beratAbk, 'berat')) / 100,
            'berat_tanpa_nama' => $beratTanpaNama / 100,
            'total_upah' => (int) $barisPemanen->sum('total_upah'),
            'pemanen' => $barisPemanen->all(),
            'nama_belum_terdaftar' => collect($beratNamaBelumTerdaftar)
                ->map(fn (array $orang): array => ['nama' => $orang['nama'], 'berat_kg' => $orang['berat'] / 100])
                ->sortBy('nama')
                ->values()
                ->all(),
            'abk' => collect($beratAbk)
                ->map(fn (array $orang): array => ['nama' => $orang['nama'], 'berat_kg' => $orang['berat'] / 100])
                ->sortBy('nama', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all(),
        ];
    }

    /**
     * Pembagian berat satu nota ke pemanennya, dalam seperseratus kg. Nota dengan krat mulai: berat timbang aktual
     * dipakai bila dicatat, sisanya dibagi menurut jumlah krat; tanpa berat aktual, berat nota dibagi menurut
     * rentang krat. Nota lama tanpa krat mulai memberi seluruh berat nota kepada setiap nama di tukang tangkap.
     *
     * @return array{rentang: list<array{nama: string, krat_mulai: ?int, krat_selesai: ?int, berat: int, manual: bool}>, tanpa_nama: int}
     */
    public static function alokasiNota(NotaPanen $nota): array
    {
        $beratNota = (int) round((float) $nota->berat_kg * 100);

        if ($nota->pemanenKrat->isEmpty()) {
            $namaTim = collect(preg_split('/[,;\r\n]+/u', $nota->tukang_tangkap ?? '', -1, PREG_SPLIT_NO_EMPTY))
                ->map(fn (string $nama): string => trim($nama))
                ->filter()
                ->unique(fn (string $nama): string => mb_strtolower($nama))
                ->values();

            return [
                'rentang' => $namaTim
                    ->map(fn (string $nama): array => ['nama' => $nama, 'krat_mulai' => null, 'krat_selesai' => null, 'berat' => $beratNota, 'manual' => false])
                    ->all(),
                'tanpa_nama' => $namaTim->isEmpty() ? $beratNota : 0,
            ];
        }

        $totalKrat = (int) $nota->jumlah_krat;
        if ($totalKrat < 1) {
            return ['rentang' => [], 'tanpa_nama' => $beratNota];
        }

        $daftarPemanen = $nota->pemanenKrat->sortBy('krat_mulai')->values();
        $adaBeratTimbangManual = $daftarPemanen->contains(
            fn ($pemanenNota): bool => $pemanenNota->berat_timbang_kg !== null,
        );
        $rentangPemanen = [];
        $beratManualTotal = 0;
        $kratTanpaBeratTotal = 0;
        $grupMenurutKratMulai = $daftarPemanen->groupBy('krat_mulai')->sortKeys()->values();

        foreach ($grupMenurutKratMulai as $index => $grupPemanen) {
            $kratMulai = (int) $grupPemanen->first()->krat_mulai;
            $kratSelesai = min(
                $index + 1 < $grupMenurutKratMulai->count()
                    ? (int) $grupMenurutKratMulai[$index + 1]->first()->krat_mulai - 1
                    : $totalKrat,
                $totalKrat,
            );

            if ($kratMulai < 1 || $kratMulai > $totalKrat || $kratSelesai < $kratMulai) {
                continue;
            }

            foreach ($grupPemanen as $pemanenNota) {
                $beratManual = $pemanenNota->berat_timbang_kg === null
                    ? null
                    : (int) round((float) $pemanenNota->berat_timbang_kg * 100);
                $rentangPemanen[] = [
                    'pemanen' => $pemanenNota,
                    'krat_mulai' => $kratMulai,
                    'krat_selesai' => $kratSelesai,
                    'berat_manual' => $beratManual,
                ];

                if ($beratManual !== null) {
                    $beratManualTotal += $beratManual;
                } else {
                    $kratTanpaBeratTotal += $kratSelesai - $kratMulai + 1;
                }
            }
        }

        $beratDialokasikan = 0;
        $hasil = [];
        $kratTanpaBeratTerkumulasi = 0;
        $beratSisaUntukPemanenTanpaBerat = max(0, $beratNota - $beratManualTotal);

        foreach ($rentangPemanen as $rentang) {
            $kratMulai = $rentang['krat_mulai'];
            $kratSelesai = $rentang['krat_selesai'];
            if ($rentang['berat_manual'] !== null) {
                $beratPemanen = $rentang['berat_manual'];
            } elseif ($adaBeratTimbangManual && $kratTanpaBeratTotal > 0) {
                $kratTanpaBeratTerkumulasi += $kratSelesai - $kratMulai + 1;
                $sampai = (int) round(
                    $beratSisaUntukPemanenTanpaBerat * $kratTanpaBeratTerkumulasi / $kratTanpaBeratTotal,
                );
                $sebelum = (int) round(
                    $beratSisaUntukPemanenTanpaBerat
                    * ($kratTanpaBeratTerkumulasi - ($kratSelesai - $kratMulai + 1))
                    / $kratTanpaBeratTotal,
                );
                $beratPemanen = $sampai - $sebelum;
            } else {
                $sebelum = (int) round($beratNota * ($kratMulai - 1) / $totalKrat);
                $sampai = (int) round($beratNota * $kratSelesai / $totalKrat);
                $beratPemanen = $sampai - $sebelum;
            }

            $nama = trim((string) $rentang['pemanen']->nama);

            if ($nama === '') {
                continue;
            }

            $beratDialokasikan += $beratPemanen;
            $hasil[] = [
                'nama' => $nama,
                'krat_mulai' => $kratMulai,
                'krat_selesai' => $kratSelesai,
                'berat' => $beratPemanen,
                'manual' => $rentang['berat_manual'] !== null,
            ];
        }

        return ['rentang' => $hasil, 'tanpa_nama' => $beratNota - $beratDialokasikan];
    }

    /**
     * Nama pemanen yang merupakan ABK: mengandung kata "ABK" (mis. "ABK K2", "Rifi ABK"), atau sama dengan nama
     * karyawan berjabatan ABK. ABK yang ikut memanen tidak dibayar di payroll pemanen.
     *
     * @param  list<string>|null  $namaKaryawanAbk  nama karyawan ABK huruf kecil; diambil dari basis data bila null
     */
    public static function abk(string $nama, ?array $namaKaryawanAbk = null): bool
    {
        $namaKaryawanAbk ??= self::namaKaryawanAbk();

        return preg_match('/(?<![\pL\pN])abk(?![\pL\pN])/iu', $nama) === 1
            || in_array(mb_strtolower(trim($nama)), $namaKaryawanAbk, true);
    }

    /**
     * @return list<string>
     */
    private static function namaKaryawanAbk(): array
    {
        return Karyawan::query()
            ->where('jabatan', Jabatan::Abk)
            ->pluck('nama')
            ->map(fn (string $nama): string => mb_strtolower(trim($nama)))
            ->values()
            ->all();
    }
}
