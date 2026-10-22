<?php

namespace App\Support;

use App\Enums\KategoriKas;
use App\Models\HargaDoc;
use App\Models\HargaKontrak;
use App\Models\NotaPanen;
use App\Models\PemberianPakan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\RhppReal;
use Illuminate\Support\Collection;

/**
 * Isi halaman RHPP (Rekapitulasi Hasil Pemeliharaan Peternak) satu periode.
 * Simulasi: nilai panen menurut harga kontrak per bracket ABW dikurangi sapronak, ditambah pendapatan lain-lain.
 * Real: angka dari dokumen RHPP inti, dibandingkan dengan harga kontrak dan dialokasikan per kandang.
 */
class LembarRhpp
{
    private const TARIF_EFISIENSI_DEFAULT_PER_KG = 260;

    /**
     * Relasi periode yang dipakai simulasi() dan real(); muat lebih dulu dengan loadMissing().
     *
     * @var list<string>
     */
    public const RELASI = [
        'notaPanen',
        'hargaKontrak',
        'rhppSimulasi',
        'rhppReal',
        'kandangPeriode.kandang',
        'kandangPeriode.recordings',
        'kandangPeriode.pemberianPakan.jenisPakan',
        'kandangPeriode.transaksiKas',
    ];

    /**
     * Pakai relasi notaPanen, hargaKontrak, rhppSimulasi, dan kandangPeriode (recordings, pemberianPakan) yang sudah di-load.
     * Mengembalikan null bila periode belum punya nota panen. Hasil null bila biaya sapronak belum lengkap.
     *
     * @return ?array{bracket: list<array{dari: float, sampai: ?float, harga: int}>, nota: list<array<string, mixed>>, total: array<string, int|float|null>, performa: array<string, ?float>, biaya: ?array<string, mixed>, hasil: ?array<string, int|float|null>, kandang: ?array<string, mixed>}
     */
    public static function simulasi(Periode $periode): ?array
    {
        $rekap = RekapPanen::buat($periode);
        if (! $rekap) {
            return null;
        }

        $nota = self::nota($periode);
        $total = self::total($nota, $rekap['total']);
        $masukan = $periode->rhppSimulasi;
        $tarifEfisiensiPerKg = (int) ($masukan?->tarif_efisiensi_per_kg ?? self::TARIF_EFISIENSI_DEFAULT_PER_KG);
        $fcrStandar = self::fcrStandarPanen($periode, $rekap['umur']);
        $performa = [
            'fcr' => $rekap['performa']['fcr'],
            'fcr_standar' => $fcrStandar,
            'umur_rata' => $rekap['performa']['umur_rata'],
            'deplesi_persen' => $rekap['performa']['deplesi_persen'],
            'ip' => $rekap['performa']['ip_terpanen'],
        ];
        $hasil = null;

        $biaya = self::ringkasanSapronak(self::sapronakSimulasi($periode));

        if ($biaya['total'] !== null) {
            $labaKotor = $total['nilai_kontrak'] - $biaya['total'];
            $selisihEfisiensi = $rekap['performa']['fcr'] !== null
                && $fcrStandar !== null
                && $rekap['performa']['fcr'] < $fcrStandar
                ? (int) round($tarifEfisiensiPerKg * $total['berat'])
                : 0;
            $subsidiNilaiPasar = 0;
            $pendapatanLain = $selisihEfisiensi + $subsidiNilaiPasar;
            $laba = $labaKotor + $pendapatanLain;
            $hasil = [
                'penjualan' => $total['nilai_kontrak'],
                'sapronak' => $biaya['total'],
                'laba_kotor' => $labaKotor,
                'selisih_efisiensi' => $selisihEfisiensi,
                'tarif_efisiensi_per_kg' => $tarifEfisiensiPerKg,
                'subsidi_nilai_pasar' => $subsidiNilaiPasar,
                'pendapatan_lain' => $pendapatanLain,
                'laba' => $laba,
                'laba_per_ekor' => $total['ekor'] > 0 ? $laba / $total['ekor'] : null,
                'laba_per_kg' => $total['berat'] > 0 ? $laba / $total['berat'] : null,
                'hpp' => $total['berat'] > 0 ? $biaya['total'] / $total['berat'] : null,
                'margin' => $total['nilai_kontrak'] > 0 ? $laba / $total['nilai_kontrak'] * 100 : null,
            ];
        }

        return [
            'bracket' => self::bracket($periode->hargaKontrak),
            'nota' => $nota->all(),
            'total' => $total,
            'performa' => $performa,
            'biaya' => $biaya,
            'hasil' => $hasil,
            'kandang' => self::simulasiPerKandang(
                $periode,
                $total,
                $biaya !== null && $biaya['total'] !== null ? $biaya : null,
                $hasil,
            ),
        ];
    }

    /**
     * FCR standar umur panen gabungan, ditimbang menurut berat panen per umur.
     *
     * @param  list<array<string, mixed>>  $umurPanen
     */
    private static function fcrStandarPanen(Periode $periode, array $umurPanen): ?float
    {
        $periode->loadMissing('kandangPeriode');
        $standar = new Standar($periode->strain, (float) ($periode->kandangPeriode->first()?->beratDocGramEfektif() ?? 0));
        $beratPanen = 0.0;
        $fcrStandarTertimbang = 0.0;

        foreach ($umurPanen as $hariPanen) {
            $fcrUmur = $standar->fcr((int) $hariPanen['umur']);
            if ($fcrUmur === null) {
                return null;
            }

            $beratPanen += (float) $hariPanen['berat'];
            $fcrStandarTertimbang += $fcrUmur * (float) $hariPanen['berat'];
        }

        return $beratPanen > 0 ? $fcrStandarTertimbang / $beratPanen : null;
    }

    /**
     * Biaya simulasi dari DOC per periode, konsumsi pakan per jenis, master harga, dan transaksi obat ayam.
     *
     * @return array{
     *     doc: array{jumlah: int, harga: float, total: int, baris: list<array<string, mixed>>},
     *     pakan: array{zak: float, kg: float, harga_per_kg: ?float, total: ?int, baris: list<array<string, mixed>>},
     *     ovk: array{total: int, baris: list<array<string, mixed>>},
     *     total: ?int,
     *     lengkap: bool,
     *     kekurangan: list<string>,
     *     per_kandang: array<int, array{doc: int, harga_doc: float, pakan_zak: float, pakan_kg: float, biaya_doc: int, biaya_pakan: ?int, biaya_ovk: int}>
     * }
     */
    public static function sapronakSimulasi(Periode $periode): array
    {
        $periode->loadMissing([
            'kandangPeriode.kandang',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'kandangPeriode.transaksiKas',
        ]);

        $hargaDocMaster = HargaDoc::query()->findOrFail(HargaDoc::GLOBAL_ID);
        $docBaris = [];
        $pakanBaris = [];
        $ovkBaris = [];
        $perKandang = [];
        $kekurangan = [];
        $jumlahDoc = 0;
        $biayaDoc = 0;
        $pakanZak = 0.0;
        $pakanKg = 0.0;
        $biayaPakan = 0;
        $pakanLengkap = true;
        $biayaOvk = 0;

        foreach ($periode->kandangPeriode as $periodeKandang) {
            $doc = $periodeKandang->populasiAktual();
            $hargaDoc = $periodeKandang->harga_doc_per_ekor ?? $hargaDocMaster->harga_per_ekor;
            $totalDoc = $doc * $hargaDoc;
            $jumlahDoc += $doc;
            $biayaDoc += $totalDoc;
            $docBaris[] = [
                'kandang' => $periodeKandang->kandang->nama,
                'jumlah' => $doc,
                'harga' => $hargaDoc,
                'total' => $totalDoc,
            ];

            $zakKandang = (float) $periodeKandang->pemberianPakan->sum('zak');
            $kgKandang = 0.0;
            $biayaPakanKandang = 0;
            $pakanKandangLengkap = $zakKandang > 0 || $doc <= 0;

            if ($periodeKandang->pemberianPakan->isEmpty() && $doc > 0) {
                $pakanKandangLengkap = false;
                $kekurangan[] = 'Catatan pemberian pakan belum tersedia untuk '.$periodeKandang->kandang->nama.'.';
            }

            foreach ($periodeKandang->pemberianPakan->groupBy(
                fn (PemberianPakan $pemberian): string => (string) ($pemberian->jenis_pakan_id ?? 'tanpa-jenis'),
            ) as $pemberianPerJenis) {
                /** @var PemberianPakan $pemberian */
                $pemberian = $pemberianPerJenis->first();
                $jenisPakan = $pemberian->jenisPakan;
                $jumlahZak = (float) $pemberianPerJenis->sum('zak');
                $hargaPerKg = $jenisPakan?->harga_per_kg;
                $kgPerZak = $jenisPakan?->kg_per_zak;
                $jumlahKg = $jenisPakan && $kgPerZak > 0 ? $jumlahZak * $kgPerZak : null;
                $totalJenis = $jenisPakan && $hargaPerKg !== null && $jumlahKg !== null
                    ? (int) round($jumlahKg * $hargaPerKg)
                    : null;
                $masalah = match (true) {
                    $jenisPakan === null => 'Jenis pakan belum ditentukan.',
                    $hargaPerKg === null || $hargaPerKg <= 0 => 'Harga master pakan belum diisi.',
                    $jumlahKg === null => 'Berat per zak pakan belum valid.',
                    default => null,
                };

                if ($masalah !== null) {
                    $pakanLengkap = false;
                    $pakanKandangLengkap = false;
                    $kekurangan[] = $periodeKandang->kandang->nama.': '.$masalah;
                } else {
                    $biayaPakanKandang += $totalJenis;
                    $biayaPakan += $totalJenis;
                }
                $pakanZak += $jumlahZak;
                if ($jumlahKg !== null) {
                    $kgKandang += $jumlahKg;
                    $pakanKg += $jumlahKg;
                }

                $pakanBaris[] = [
                    'kandang' => $periodeKandang->kandang->nama,
                    'jenis' => $jenisPakan?->kode ?? 'Jenis pakan belum ditentukan',
                    'zak' => $jumlahZak,
                    'kg' => $jumlahKg,
                    'harga_per_kg' => $hargaPerKg,
                    'total' => $totalJenis,
                    'masalah' => $masalah,
                ];
            }

            if ($zakKandang <= 0 && $doc > 0) {
                $pakanKandangLengkap = false;
            }

            $totalOvkKandang = (int) $periodeKandang->transaksiKas
                ->where('kategori', KategoriKas::ObatAyam)
                ->sum('jumlah');
            $biayaOvk += $totalOvkKandang;
            $ovkBaris[] = [
                'kandang' => $periodeKandang->kandang->nama,
                'total' => $totalOvkKandang,
            ];

            $perKandang[$periodeKandang->id] = [
                'doc' => $doc,
                'harga_doc' => $hargaDoc,
                'pakan_zak' => $zakKandang,
                'pakan_kg' => $kgKandang,
                'biaya_doc' => $totalDoc,
                'biaya_pakan' => $pakanKandangLengkap ? $biayaPakanKandang : null,
                'biaya_ovk' => $totalOvkKandang,
            ];
        }

        $rekapPakanZak = $periode->rekap_pakan_zak;
        if ($rekapPakanZak !== null && round($pakanZak, 1) !== round($rekapPakanZak, 1)) {
            $pakanLengkap = false;
            $kekurangan[] = 'Pemakaian pakan tercatat '.Format::angka($pakanZak, 1).' zak, berbeda dari rekap periode '.Format::angka($rekapPakanZak, 1).' zak.';
        }

        $pakanLengkap = $pakanLengkap && $pakanZak > 0;
        $biayaPakan = $pakanLengkap ? $biayaPakan : null;
        $totalSapronak = $pakanLengkap ? $biayaDoc + $biayaPakan + $biayaOvk : null;

        return [
            'doc' => [
                'jumlah' => $jumlahDoc,
                'harga' => $jumlahDoc > 0 ? $biayaDoc / $jumlahDoc : (float) $hargaDocMaster->harga_per_ekor,
                'total' => $biayaDoc,
                'baris' => $docBaris,
            ],
            'pakan' => [
                'zak' => $pakanZak,
                'kg' => $pakanKg,
                'harga_per_kg' => $pakanLengkap && $pakanKg > 0 ? $biayaPakan / $pakanKg : null,
                'total' => $biayaPakan,
                'baris' => $pakanBaris,
            ],
            'ovk' => [
                'total' => $biayaOvk,
                'baris' => $ovkBaris,
            ],
            'total' => $totalSapronak,
            'lengkap' => $pakanLengkap,
            'kekurangan' => array_values(array_unique($kekurangan)),
            'per_kandang' => $perKandang,
        ];
    }

    /**
     * Angka RHPP real yang dapat dihitung ulang dari sumber data operasional periode.
     *
     * DOC yang diklaim kembali ke inti (mati di perjalanan) mengurangi populasi DOC yang dibesarkan:
     * jumlah DOC, biaya DOC, deplesi, dan IP memakai DOC efektif, yaitu DOC dikurangi klaim.
     *
     * @param  int  $docDiklaim  DOC yang diklaim kembali ke inti.
     * @return array{
     *     doc_ekor: int,
     *     doc_total: int,
     *     pakan_kg: float,
     *     pakan_total: ?int,
     *     ovk_total: int,
     *     fcr_aktual: ?float,
     *     fcr_standar: ?float,
     *     deplesi_persen: ?float,
     *     deplesi_standar_persen: ?float,
     *     umur_rata: ?float,
     *     ip: ?int,
     *     peringatan: list<string>
     * }
     */
    public static function dataProduksiReal(Periode $periode, int $docDiklaim = 0): array
    {
        $periode->loadMissing([
            'kandangPeriode.kandang',
            'kandangPeriode.recordings',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'kandangPeriode.transaksiKas',
            'notaPanen',
        ]);

        $sapronak = self::sapronakSimulasi($periode);
        $docAwal = $sapronak['doc']['jumlah'];
        $docDiklaim = max(0, min($docDiklaim, $docAwal));
        $rekap = RekapPanen::buat($periode, $docDiklaim);
        $performa = $rekap['performa'] ?? [];
        $umurRata = $performa['umur_rata'] ?? null;
        $standar = new Standar($periode->strain, (float) ($periode->kandangPeriode->first()?->beratDocGramEfektif() ?? 0));
        $umurStandar = $umurRata !== null ? (int) round($umurRata) : null;
        $fcrStandar = $rekap ? self::fcrStandarPanen($periode, $rekap['umur']) : null;
        $deplesiStandar = $umurStandar !== null ? $standar->deplesiPersen($umurStandar) : null;
        $peringatan = $sapronak['kekurangan'];

        foreach ([
            'FCR aktual' => $performa['fcr'] ?? null,
            'FCR standar' => $fcrStandar,
            'deplesi aktual' => $performa['deplesi_persen'] ?? null,
            'deplesi standar' => $deplesiStandar,
            'umur rata-rata' => $umurRata,
            'IP' => $performa['ip_terpanen'] ?? null,
        ] as $label => $nilai) {
            if ($nilai === null) {
                $peringatan[] = 'Data '.$label.' belum tersedia dari sumber periode.';
            }
        }

        return [
            'doc_ekor' => $docAwal - $docDiklaim,
            'doc_total' => $sapronak['doc']['total'] - self::nilaiKlaimDoc($sapronak['per_kandang'], $docDiklaim),
            'pakan_kg' => round($sapronak['pakan']['kg'], 2),
            'pakan_total' => $sapronak['pakan']['total'],
            'ovk_total' => $sapronak['ovk']['total'],
            'fcr_aktual' => isset($performa['fcr']) ? round($performa['fcr'], 3) : null,
            'fcr_standar' => $fcrStandar !== null ? round($fcrStandar, 3) : null,
            'deplesi_persen' => isset($performa['deplesi_persen']) ? round($performa['deplesi_persen'], 2) : null,
            'deplesi_standar_persen' => $deplesiStandar,
            'umur_rata' => $umurRata !== null ? round($umurRata, 2) : null,
            'ip' => isset($performa['ip_terpanen']) ? (int) round($performa['ip_terpanen']) : null,
            'peringatan' => array_values(array_unique($peringatan)),
        ];
    }

    /**
     * Ringkasan DOC yang diklaim kembali ke inti: jumlah ekor dan nilai rupiahnya.
     *
     * @return ?array{ekor: int, nilai: int, harga: ?float}
     */
    public static function rekapKlaimDoc(Periode $periode, int $docDiklaim): ?array
    {
        if ($docDiklaim <= 0) {
            return null;
        }

        $sapronak = self::sapronakSimulasi($periode);
        $ekor = min($docDiklaim, $sapronak['doc']['jumlah']);
        $nilai = self::nilaiKlaimDoc($sapronak['per_kandang'], $ekor);

        return [
            'ekor' => $ekor,
            'nilai' => $nilai,
            'harga' => $ekor > 0 ? $nilai / $ekor : null,
        ];
    }

    /**
     * Nilai rupiah DOC yang diklaim kembali ke inti. Klaim dibagi ke tiap kandang menurut DOC-nya,
     * lalu dihargai dengan harga DOC kandang tersebut.
     *
     * @param  array<int, array{doc: int, harga_doc: float}>  $perKandang
     */
    private static function nilaiKlaimDoc(array $perKandang, int $docDiklaim): int
    {
        if ($docDiklaim <= 0 || $perKandang === []) {
            return 0;
        }

        $bobot = array_values(array_map(fn (array $satu): int => (int) $satu['doc'], $perKandang));
        if ((int) array_sum($bobot) <= 0) {
            return 0;
        }

        $alokasi = self::bagiNilai($docDiklaim, $bobot);
        $nilai = 0;
        foreach (array_values($perKandang) as $indeks => $satu) {
            $nilai += (int) round($alokasi[$indeks] * $satu['harga_doc']);
        }

        return $nilai;
    }

    /**
     * @param  array{
     *     doc: array{jumlah: int, harga: float, total: int, baris: list<array<string, mixed>>},
     *     pakan: array{zak: float, kg: float, harga_per_kg: ?float, total: ?int, baris: list<array<string, mixed>>},
     *     ovk: array{total: int, baris: list<array<string, mixed>>},
     *     total: ?int,
     *     lengkap: bool,
     *     kekurangan: list<string>,
     *     per_kandang: array<int, array{doc: int, harga_doc: float, pakan_zak: float, pakan_kg: float, biaya_doc: int, biaya_pakan: ?int, biaya_ovk: int}>
     * }  $sapronak
     * @return array<string, mixed>
     */
    private static function ringkasanSapronak(array $sapronak): array
    {
        return [
            'doc' => $sapronak['doc']['jumlah'],
            'harga_doc' => (int) round($sapronak['doc']['harga']),
            'biaya_doc' => $sapronak['doc']['total'],
            'pakan_zak' => $sapronak['pakan']['zak'],
            'harga_pakan' => $sapronak['pakan']['total'] !== null && $sapronak['pakan']['zak'] > 0
                ? $sapronak['pakan']['total'] / $sapronak['pakan']['zak']
                : null,
            'biaya_pakan' => $sapronak['pakan']['total'],
            'biaya_ovk' => $sapronak['ovk']['total'],
            'total' => $sapronak['total'],
            'per_kandang' => $sapronak['per_kandang'],
        ];
    }

    /**
     * Proyeksi per kandang: pakan dan DOC mengikuti data aktual; penjualan, OVK, dan selisih efisiensi dibagi menurut tonase.
     *
     * @param  array<string, int|float|null>  $total
     * @param  ?array<string, mixed>  $biaya
     * @param  ?array<string, int|float|null>  $hasil
     * @return ?array{baris: list<array<string, mixed>>, total: array<string, mixed>, cocok: bool, panen_sesuai: bool}
     */
    private static function simulasiPerKandang(Periode $periode, array $total, ?array $biaya, ?array $hasil): ?array
    {
        $kandang = $periode->kandangPeriode->sortBy('kandang.nama')->values();
        if ($kandang->isEmpty()) {
            return null;
        }

        $pakanKgPerZak = config('standar.kg_per_zak');
        $rincian = $kandang->map(function (PeriodeKandang $satu) use ($pakanKgPerZak): array {
            $pakanKg = (float) $satu->pemberianPakan->sum(
                fn (PemberianPakan $pemberian): float => $pemberian->zak * ($pemberian->jenisPakan?->kg_per_zak ?? $pakanKgPerZak),
            );

            return [
                'id' => $satu->id,
                'nama' => $satu->kandang->nama,
                'doc' => $satu->populasiAktual(),
                'pakan_zak' => (float) $satu->pemberianPakan->sum('zak'),
                'pakan_kg' => $pakanKg,
                'ekor' => (int) ($satu->panen_ekor ?? 0),
                'berat' => (float) ($satu->panen_tonase_kg ?? 0),
                'trip' => (int) ($satu->panen_trip ?? 0),
            ];
        });

        $doc = (int) $rincian->sum('doc');
        $pakanKg = (float) $rincian->sum('pakan_kg');
        $berat = (float) $rincian->sum('berat');
        $kandangBerpopulasi = $rincian->filter(fn (array $satu): bool => $satu['doc'] > 0);
        if (
            $total['berat'] > 0
            && $kandangBerpopulasi->count() === 1
            && $kandangBerpopulasi->first()['berat'] <= 0
        ) {
            $idKandangBerpopulasi = $kandangBerpopulasi->first()['id'];
            $rincian = $rincian->map(fn (array $satu): array => $satu['id'] === $idKandangBerpopulasi
                ? [...$satu, 'ekor' => (int) $total['ekor'], 'berat' => (float) $total['berat'], 'trip' => (int) $total['jumlah_nota']]
                : $satu);
            $berat = (float) $rincian->sum('berat');
        }

        if ($doc <= 0 || $pakanKg <= 0 || $berat <= 0) {
            return null;
        }

        $alokasi = [
            'penjualan' => self::bagiNilai((int) $total['nilai_kontrak'], $rincian->pluck('berat')->all()),
        ];
        if ($biaya !== null) {
            $alokasi += [
                'selisih_efisiensi' => self::bagiNilai((int) $hasil['selisih_efisiensi'], $rincian->pluck('berat')->all()),
            ];
        }

        $baris = $rincian->values()->map(function (array $satu, int $indeks) use ($alokasi, $biaya, $berat): array {
            $penjualan = $alokasi['penjualan'][$indeks];
            $biayaKandang = $biaya['per_kandang'][$satu['id']] ?? null;
            $biayaDoc = $biayaKandang['biaya_doc'] ?? null;
            $biayaPakan = $biayaKandang['biaya_pakan'] ?? null;
            $biayaOvk = $biayaKandang['biaya_ovk'] ?? null;
            $selisihEfisiensi = $biaya === null ? null : $alokasi['selisih_efisiensi'][$indeks];
            $sapronak = $biaya === null ? null : $biayaDoc + $biayaPakan + $biayaOvk;
            $labaKotor = $sapronak === null ? null : $penjualan - $sapronak;
            $laba = $labaKotor === null ? null : $labaKotor + $selisihEfisiensi;

            return [
                ...$satu,
                'bagian_tonase' => $berat > 0 ? $satu['berat'] / $berat * 100 : 0.0,
                'penjualan' => $penjualan,
                'biaya_doc' => $biayaDoc,
                'biaya_pakan' => $biayaPakan,
                'biaya_ovk' => $biayaOvk,
                'sapronak' => $sapronak,
                'laba_kotor' => $labaKotor,
                'selisih_efisiensi' => $selisihEfisiensi,
                'laba' => $laba,
                'abw' => $satu['ekor'] > 0 ? $satu['berat'] / $satu['ekor'] : null,
                'fcr' => $satu['berat'] > 0 ? $satu['pakan_kg'] / $satu['berat'] : null,
                'hpp' => $satu['berat'] > 0 && $sapronak !== null ? $sapronak / $satu['berat'] : null,
                'margin' => $penjualan > 0 && $laba !== null ? $laba / $penjualan * 100 : null,
            ];
        });

        $panenSesuai = round($berat, 2) === (float) $total['berat']
            && (int) $rincian->sum('ekor') === (int) $total['ekor'];
        $cocok = $biaya === null || (
            (int) $baris->sum('penjualan') === (int) $total['nilai_kontrak']
            && (int) $baris->sum('sapronak') === (int) $biaya['total']
            && (int) $baris->sum('laba') === (int) $hasil['laba']
        );

        return [
            'baris' => $baris->all(),
            'total' => [
                'doc' => $doc,
                'pakan_zak' => (float) $rincian->sum('pakan_zak'),
                'pakan_kg' => $pakanKg,
                'ekor' => (int) $rincian->sum('ekor'),
                'berat' => $berat,
                'abw' => $rincian->sum('ekor') > 0 ? $berat / $rincian->sum('ekor') : null,
                'fcr' => $berat > 0 ? $pakanKg / $berat : null,
                'penjualan' => (int) $baris->sum('penjualan'),
                'biaya_doc' => $biaya === null ? null : (int) $baris->sum('biaya_doc'),
                'biaya_pakan' => $biaya === null ? null : (int) $baris->sum('biaya_pakan'),
                'biaya_ovk' => $biaya === null ? null : (int) $baris->sum('biaya_ovk'),
                'sapronak' => $biaya === null ? null : (int) $baris->sum('sapronak'),
                'laba_kotor' => $biaya === null ? null : (int) $baris->sum('laba_kotor'),
                'selisih_efisiensi' => $biaya === null ? null : (int) $baris->sum('selisih_efisiensi'),
                'laba' => $biaya === null ? null : (int) $baris->sum('laba'),
                'hpp' => $biaya === null || $berat <= 0 ? null : $baris->sum('sapronak') / $berat,
                'margin' => $biaya === null || $total['nilai_kontrak'] <= 0
                    ? null
                    : $baris->sum('laba') / $total['nilai_kontrak'] * 100,
            ],
            'cocok' => $cocok,
            'panen_sesuai' => $panenSesuai,
        ];
    }

    /**
     * Membagi nilai bulat dan memberikan sisa pembulatan ke kandang terakhir.
     *
     * @param  list<int|float>  $bobot
     * @return list<int>
     */
    private static function bagiNilai(int $nilai, array $bobot): array
    {
        $jumlahBobot = array_sum($bobot);
        $dibagikan = 0;
        $hasil = [];

        foreach ($bobot as $indeks => $bagian) {
            $alokasi = $indeks === array_key_last($bobot)
                ? $nilai - $dibagikan
                : (int) round($nilai * $bagian / $jumlahBobot);
            $hasil[] = $alokasi;
            $dibagikan += $alokasi;
        }

        return $hasil;
    }

    /**
     * Pakai relasi notaPanen, hargaKontrak, rhppReal, dan kandangPeriode.kandang yang sudah di-load.
     * Mengembalikan null bila dokumen RHPP real periode ini belum dicatat atau belum ada nota panen.
     *
     * @return ?array{dokumen: RhppReal, sapronak: array<string, mixed>, kinerja: array<string, mixed>, rekap: array<string, int|null>, satuan: array<string, int|float|null>, trip: list<array<string, mixed>>, total: array<string, int|float|null>, kandang: ?array<string, mixed>, peringatan_sumber: list<string>}
     */
    public static function real(Periode $periode): ?array
    {
        $dokumen = $periode->rhppReal;
        if (! $dokumen || $periode->notaPanen->isEmpty()) {
            return null;
        }

        $docDiklaim = (int) ($dokumen->doc_diklaim_ekor ?? 0);
        $dataProduksi = self::dataProduksiReal($periode, $docDiklaim);
        $nilaiProduksi = $dataProduksi;
        unset($nilaiProduksi['peringatan']);

        if (! in_array(null, $nilaiProduksi, true)) {
            foreach ($nilaiProduksi as $kolom => $nilai) {
                $dokumen->setAttribute($kolom, $nilai);
            }
        }

        $nota = self::nota($periode);
        $total = self::total($nota, RekapPanen::buat($periode, $docDiklaim)['total']);

        $sapronak = [
            ['uraian' => 'Bibit ayam (DOC)', 'jumlah' => (float) $dokumen->doc_ekor, 'satuan' => 'EK', 'total' => $dokumen->doc_total],
            ['uraian' => 'Pakan ternak (MT)', 'jumlah' => $dokumen->pakan_kg, 'satuan' => 'KG', 'total' => $dokumen->pakan_total],
            ['uraian' => 'Obat, vaksin, kimia (OVK)', 'jumlah' => $dokumen->ovk_jumlah, 'satuan' => $dokumen->ovk_satuan, 'total' => $dokumen->ovk_total],
        ];
        $totalSapronak = collect($sapronak)->contains(fn (array $baris): bool => $baris['total'] === null)
            ? null
            : array_sum(array_column($sapronak, 'total'));

        $efisiensi = (int) round($dokumen->tarif_efisiensi_per_kg * $total['berat']);
        $selisihBudidaya = $totalSapronak !== null ? $total['nilai_real'] - $totalSapronak : null;
        $bersih = $selisihBudidaya !== null
            ? $selisihBudidaya + $efisiensi + $dokumen->subsidi_harga_pasar
            : null;
        $rekap = [
            'total_panen' => $total['nilai_real'],
            'sapronak' => $totalSapronak,
            'selisih_budidaya' => $selisihBudidaya,
            'efisiensi' => $efisiensi,
            'tarif_efisiensi' => $dokumen->tarif_efisiensi_per_kg,
            'subsidi' => $dokumen->subsidi_harga_pasar,
            'lain' => $efisiensi + $dokumen->subsidi_harga_pasar,
            'bersih' => $bersih,
        ];

        $subsidiPerKg = $total['berat'] > 0 ? $dokumen->subsidi_harga_pasar / $total['berat'] : 0.0;
        // Subsidi harga pasar dibagi ke tiap trip sebanding tonasenya.
        $trip = $nota->map(fn (array $satu): array => [...$satu, 'alokasi_subsidi' => (int) round($satu['berat'] * $subsidiPerKg)]);

        return [
            'dokumen' => $dokumen,
            'doc_diklaim' => $docDiklaim,
            'rekap_klaim' => self::rekapKlaimDoc($periode, $docDiklaim),
            'sapronak' => [
                'baris' => array_map(fn (array $baris): array => [...$baris, 'harga' => $baris['jumlah'] > 0 ? $baris['total'] / $baris['jumlah'] : null], $sapronak),
                'total' => $totalSapronak,
            ],
            'kinerja' => [
                'ekor' => $total['ekor'],
                'berat' => $total['berat'],
                'total_panen' => $total['nilai_real'],
                'harga_rata' => $total['harga_real'],
                'bw' => $total['abw'],
                'fcr' => [
                    'aktual' => $dokumen->fcr_aktual,
                    'standar' => $dokumen->fcr_standar,
                    'selisih' => $dokumen->fcr_aktual !== null && $dokumen->fcr_standar !== null
                        ? $dokumen->fcr_aktual - $dokumen->fcr_standar
                        : null,
                ],
                'deplesi' => [
                    'aktual' => $dokumen->deplesi_persen,
                    'standar' => $dokumen->deplesi_standar_persen,
                    'selisih' => $dokumen->deplesi_persen !== null && $dokumen->deplesi_standar_persen !== null
                        ? $dokumen->deplesi_persen - $dokumen->deplesi_standar_persen
                        : null,
                ],
                'umur_rata' => $dokumen->umur_rata,
                'ip' => $dokumen->ip,
            ],
            'rekap' => $rekap,
            'satuan' => [
                'subsidi_per_kg' => $subsidiPerKg,
                'subsidi_per_ekor' => $total['ekor'] > 0 ? $dokumen->subsidi_harga_pasar / $total['ekor'] : null,
                'subsidi_prestasi_per_kg' => $subsidiPerKg + $dokumen->tarif_efisiensi_per_kg,
                'budidaya_efisiensi' => $rekap['selisih_budidaya'] !== null ? $rekap['selisih_budidaya'] + $efisiensi : null,
                'doc' => $dokumen->doc_ekor,
                'doc_diklaim' => $docDiklaim,
                'doc_dikirim' => (int) $dokumen->doc_ekor + $docDiklaim,
                'nilai_per_doc' => $dokumen->doc_ekor > 0 && $rekap['selisih_budidaya'] !== null
                    ? ($rekap['selisih_budidaya'] + $efisiensi) / $dokumen->doc_ekor
                    : null,
            ],
            'trip' => $trip->all(),
            'total' => [...$total, 'alokasi_subsidi' => (int) $trip->sum('alokasi_subsidi')],
            'kandang' => $totalSapronak !== null ? self::perKandang($periode, $total, $rekap) : null,
            'peringatan_sumber' => $dataProduksi['peringatan'],
        ];
    }

    /**
     * Harga kontrak untuk satu ABW: harga pada rentang yang mencakup ABW tersebut.
     *
     * @param  Collection<int, HargaKontrak>  $bracket
     */
    public static function hargaKontrak(Collection $bracket, ?float $abw): ?int
    {
        if ($abw === null) {
            return null;
        }

        $abwDalamPerseratus = floor($abw * 100) / 100;

        return $bracket->first(fn (HargaKontrak $satu): bool => $satu->bobot_min_kg <= $abwDalamPerseratus && $satu->bobot_max_kg >= $abwDalamPerseratus)?->harga_per_kg;
    }

    /**
     * Tiap nota panen dengan harga dan nilainya menurut kontrak dan menurut RHPP real.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private static function nota(Periode $periode): Collection
    {
        $nomorHari = $periode->notaPanen
            ->map(fn (NotaPanen $nota): string => $nota->tanggal_panen->toDateString())
            ->unique()
            ->sort()
            ->values()
            ->flip();

        return $periode->notaPanen->values()->map(function (NotaPanen $nota) use ($periode, $nomorHari): array {
            $abw = $nota->ekor > 0 ? $nota->berat_kg / $nota->ekor : null;
            $hargaKontrak = self::hargaKontrak($periode->hargaKontrak, $abw);
            $nilaiKontrak = $hargaKontrak !== null ? self::nilaiPanen($nota->berat_kg, $hargaKontrak) : null;
            $nilaiReal = $nota->harga_real_per_kg !== null ? self::nilaiPanen($nota->berat_kg, $nota->harga_real_per_kg) : null;

            return [
                'hari' => $nomorHari[$nota->tanggal_panen->toDateString()] + 1,
                'tanggal' => $nota->mulai,
                'no_spa' => $nota->no_spa,
                'no_btpa' => $nota->no_btpa,
                'no_polisi' => $nota->no_polisi,
                'pembeli' => $nota->pembeli,
                'ekor' => $nota->ekor,
                'berat' => $nota->berat_kg,
                'abw' => $abw,
                'harga_kontrak' => $hargaKontrak,
                'nilai_kontrak' => $nilaiKontrak,
                'harga_real' => $nota->harga_real_per_kg,
                'nilai_real' => $nilaiReal,
                'selisih_harga' => $hargaKontrak !== null && $nota->harga_real_per_kg !== null ? $nota->harga_real_per_kg - $hargaKontrak : null,
                'selisih_nilai' => $nilaiKontrak !== null && $nilaiReal !== null ? $nilaiReal - $nilaiKontrak : null,
            ];
        });
    }

    /**
     * Jumlah seluruh nota; harga rata-rata tertimbang tonase.
     *
     * @param  Collection<int, array<string, mixed>>  $nota
     * @param  array<string, int|float|null>  $panen  total dari RekapPanen
     * @return array<string, int|float|null>
     */
    private static function total(Collection $nota, array $panen): array
    {
        $berat = (float) $panen['berat'];
        $nilaiKontrak = (int) $nota->sum('nilai_kontrak');
        $nilaiReal = (int) $nota->sum('nilai_real');

        return [
            'jumlah_nota' => $nota->count(),
            'ekor' => (int) $panen['ekor'],
            'berat' => $berat,
            'abw' => $panen['bw'],
            'nilai_kontrak' => $nilaiKontrak,
            'harga_kontrak' => $berat > 0 ? $nilaiKontrak / $berat : null,
            'tanpa_harga_kontrak' => $nota->whereNull('harga_kontrak')->count(),
            'nilai_real' => $nilaiReal,
            'harga_real' => $berat > 0 ? $nilaiReal / $berat : null,
            'selisih_harga' => $berat > 0 ? ($nilaiReal - $nilaiKontrak) / $berat : null,
            'selisih_nilai' => $nilaiReal - $nilaiKontrak,
        ];
    }

    private static function nilaiPanen(float $berat, int $harga): int
    {
        $beratDalamPerseratusKg = (int) round($berat * 100);

        return intdiv($beratDalamPerseratusKg * $harga + 50, 100);
    }

    /**
     * Bracket harga kontrak sebagai rentang ABW.
     *
     * @param  Collection<int, HargaKontrak>  $bracket
     * @return list<array{dari: float, sampai: float, harga: int}>
     */
    private static function bracket(Collection $bracket): array
    {
        $urut = $bracket->sortBy('bobot_min_kg')->values();

        return $urut->map(fn (HargaKontrak $satu): array => [
            'dari' => $satu->bobot_min_kg,
            'sampai' => $satu->bobot_max_kg,
            'harga' => $satu->harga_per_kg,
        ])->all();
    }

    /**
     * Penghasilan per kandang: nilai Rp dialokasikan sebanding tonase panen tiap kandang.
     * Kandang terakhir menerima sisa agar jumlahnya tepat sama dengan total RHPP.
     * Null bila rekap panen per kandang belum diisi.
     *
     * @param  array<string, int|float|null>  $total
     * @param  array<string, int>  $rekap
     * @return ?array{kolom: list<array<string, mixed>>, total: array<string, mixed>, cocok: bool}
     */
    private static function perKandang(Periode $periode, array $total, array $rekap): ?array
    {
        $kandang = $periode->kandangPeriode->whereNotNull('panen_tonase_kg')->sortBy('kandang.nama')->values();
        if ($kandang->isEmpty() || $total['berat'] <= 0) {
            return null;
        }

        $dialokasikan = ['total_panen', 'sapronak', 'efisiensi', 'subsidi'];
        $terpakai = array_fill_keys($dialokasikan, 0);

        $kolom = $kandang->map(function (PeriodeKandang $satu, int $indeks) use ($kandang, $total, $rekap, $dialokasikan, &$terpakai): array {
            $bagian = $satu->panen_tonase_kg / $total['berat'];
            $nilai = [];
            foreach ($dialokasikan as $kunci) {
                $nilai[$kunci] = $indeks === $kandang->count() - 1 ? $rekap[$kunci] - $terpakai[$kunci] : (int) round($rekap[$kunci] * $bagian);
                $terpakai[$kunci] += $nilai[$kunci];
            }

            return ['kandang_id' => $satu->kandang_id, ...self::kolomKandang($satu->kandang->nama, $satu->panen_trip, $satu->panen_ekor, $satu->panen_tonase_kg, $bagian * 100, $nilai)];
        });

        return [
            'kolom' => $kolom->all(),
            'total' => self::kolomKandang('Total', (int) $kandang->sum('panen_trip'), (int) $total['ekor'], (float) $total['berat'], 100.0, array_intersect_key($rekap, array_flip($dialokasikan))),
            'cocok' => (int) $kolom->sum('bersih') === $rekap['bersih'],
        ];
    }

    /**
     * @param  array{total_panen: int, sapronak: int, efisiensi: int, subsidi: int}  $nilai
     * @return array<string, mixed>
     */
    private static function kolomKandang(string $nama, int $trip, int $ekor, float $tonase, float $bagianPersen, array $nilai): array
    {
        $selisih = $nilai['total_panen'] - $nilai['sapronak'];
        $lain = $nilai['efisiensi'] + $nilai['subsidi'];
        $bersih = $selisih + $lain;

        return [
            'nama' => $nama,
            'trip' => $trip,
            'ekor' => $ekor,
            'tonase' => $tonase,
            'bw' => $ekor > 0 ? $tonase / $ekor : null,
            'bagian_persen' => $bagianPersen,
            ...$nilai,
            'selisih_budidaya' => $selisih,
            'lain' => $lain,
            'bersih' => $bersih,
            'bersih_per_kg' => $tonase > 0 ? $bersih / $tonase : null,
            'bersih_per_ekor' => $ekor > 0 ? $bersih / $ekor : null,
            'subsidi_per_kg' => $tonase > 0 ? $nilai['subsidi'] / $tonase : null,
            'bersih_per_trip' => $trip > 0 ? $bersih / $trip : null,
        ];
    }
}
