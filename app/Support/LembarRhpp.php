<?php

namespace App\Support;

use App\Models\HargaKontrak;
use App\Models\NotaPanen;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\RhppReal;
use Illuminate\Support\Collection;

/**
 * Isi halaman RHPP (Rekapitulasi Hasil Pemeliharaan Peternak) satu periode.
 * Simulasi: nilai panen menurut harga kontrak per bracket ABW dikurangi biaya sapronak perkiraan.
 * Real: angka dari dokumen RHPP inti, dibandingkan dengan harga kontrak dan dialokasikan per kandang.
 */
class LembarRhpp
{
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
        'kandangPeriode.pemberianPakan',
    ];

    /**
     * Pakai relasi notaPanen, hargaKontrak, rhppSimulasi, dan kandangPeriode (recordings, pemberianPakan) yang sudah di-load.
     * Mengembalikan null bila periode belum punya nota panen. Biaya dan hasil null bila input simulasi belum diisi.
     *
     * @return ?array{kontrak: ?string, bracket: list<array{dari: float, sampai: ?float, harga: int}>, nota: list<array<string, mixed>>, total: array<string, int|float|null>, performa: array<string, ?float>, biaya: ?array<string, int|float>, hasil: ?array<string, int|float|null>}
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
        $biaya = null;
        $hasil = null;

        if ($masukan) {
            $doc = $rekap['performa']['doc'];
            $pakanZak = $rekap['performa']['pakan_zak'];
            $biaya = [
                'doc' => $doc,
                'harga_doc' => $masukan->harga_doc,
                'biaya_doc' => $doc * $masukan->harga_doc,
                'pakan_zak' => $pakanZak,
                'harga_pakan' => $pakanZak > 0 ? $masukan->biaya_pakan / $pakanZak : null,
                'biaya_pakan' => $masukan->biaya_pakan,
                'biaya_ovk' => $masukan->biaya_ovk,
                'total' => $doc * $masukan->harga_doc + $masukan->biaya_pakan + $masukan->biaya_ovk,
            ];

            $labaKotor = $total['nilai_kontrak'] - $biaya['total'];
            $laba = $labaKotor + $masukan->insentif;
            $hasil = [
                'penjualan' => $total['nilai_kontrak'],
                'sapronak' => $biaya['total'],
                'laba_kotor' => $labaKotor,
                'insentif' => $masukan->insentif,
                'laba' => $laba,
                'laba_per_ekor' => $total['ekor'] > 0 ? $laba / $total['ekor'] : null,
                'laba_per_kg' => $total['berat'] > 0 ? $laba / $total['berat'] : null,
                'hpp' => $total['berat'] > 0 ? $biaya['total'] / $total['berat'] : null,
                'margin' => $total['nilai_kontrak'] > 0 ? $laba / $total['nilai_kontrak'] * 100 : null,
            ];
        }

        return [
            'kontrak' => $masukan?->kontrak,
            'bracket' => self::bracket($periode->hargaKontrak),
            'nota' => $nota->all(),
            'total' => $total,
            'performa' => [
                'fcr' => $rekap['performa']['fcr'],
                'umur_rata' => $rekap['performa']['umur_rata'],
                'deplesi_persen' => $rekap['performa']['deplesi_persen'],
                'ip' => $rekap['performa']['ip_terpanen'],
            ],
            'biaya' => $biaya,
            'hasil' => $hasil,
        ];
    }

    /**
     * Pakai relasi notaPanen, hargaKontrak, rhppReal, dan kandangPeriode.kandang yang sudah di-load.
     * Mengembalikan null bila dokumen RHPP real periode ini belum dicatat atau belum ada nota panen.
     *
     * @return ?array{dokumen: RhppReal, sapronak: array<string, mixed>, kinerja: array<string, mixed>, rekap: array<string, int>, satuan: array<string, int|float|null>, trip: list<array<string, mixed>>, total: array<string, int|float|null>, kandang: ?array<string, mixed>}
     */
    public static function real(Periode $periode): ?array
    {
        $dokumen = $periode->rhppReal;
        if (! $dokumen || $periode->notaPanen->isEmpty()) {
            return null;
        }

        $nota = self::nota($periode);
        $total = self::total($nota, RekapPanen::buat($periode)['total']);

        $sapronak = [
            ['uraian' => 'Bibit ayam (DOC)', 'jumlah' => (float) $dokumen->doc_ekor, 'satuan' => 'EK', 'total' => $dokumen->doc_total],
            ['uraian' => 'Pakan ternak (MT)', 'jumlah' => $dokumen->pakan_kg, 'satuan' => 'KG', 'total' => $dokumen->pakan_total],
            ['uraian' => 'Obat, vaksin, kimia (OVK)', 'jumlah' => $dokumen->ovk_jumlah, 'satuan' => $dokumen->ovk_satuan, 'total' => $dokumen->ovk_total],
        ];
        $totalSapronak = array_sum(array_column($sapronak, 'total'));

        $efisiensi = (int) round($dokumen->tarif_efisiensi_per_kg * $total['berat']);
        $rekap = [
            'total_panen' => $total['nilai_real'],
            'sapronak' => $totalSapronak,
            'selisih_budidaya' => $total['nilai_real'] - $totalSapronak,
            'efisiensi' => $efisiensi,
            'tarif_efisiensi' => $dokumen->tarif_efisiensi_per_kg,
            'subsidi' => $dokumen->subsidi_harga_pasar,
            'lain' => $efisiensi + $dokumen->subsidi_harga_pasar,
            'bersih' => $total['nilai_real'] - $totalSapronak + $efisiensi + $dokumen->subsidi_harga_pasar,
        ];

        $subsidiPerKg = $total['berat'] > 0 ? $dokumen->subsidi_harga_pasar / $total['berat'] : 0.0;
        // Subsidi harga pasar dibagi ke tiap trip sebanding tonasenya.
        $trip = $nota->map(fn (array $satu): array => [...$satu, 'alokasi_subsidi' => (int) round($satu['berat'] * $subsidiPerKg)]);

        return [
            'dokumen' => $dokumen,
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
                'fcr' => ['aktual' => $dokumen->fcr_aktual, 'standar' => $dokumen->fcr_standar, 'selisih' => $dokumen->fcr_aktual - $dokumen->fcr_standar],
                'deplesi' => ['aktual' => $dokumen->deplesi_persen, 'standar' => $dokumen->deplesi_standar_persen, 'selisih' => $dokumen->deplesi_persen - $dokumen->deplesi_standar_persen],
                'umur_rata' => $dokumen->umur_rata,
                'ip' => $dokumen->ip,
            ],
            'rekap' => $rekap,
            'satuan' => [
                'subsidi_per_kg' => $subsidiPerKg,
                'subsidi_per_ekor' => $total['ekor'] > 0 ? $dokumen->subsidi_harga_pasar / $total['ekor'] : null,
                'subsidi_prestasi_per_kg' => $subsidiPerKg + $dokumen->tarif_efisiensi_per_kg,
                'budidaya_efisiensi' => $rekap['selisih_budidaya'] + $efisiensi,
                'doc' => $dokumen->doc_ekor,
                'nilai_per_doc' => $dokumen->doc_ekor > 0 ? ($rekap['selisih_budidaya'] + $efisiensi) / $dokumen->doc_ekor : null,
            ],
            'trip' => $trip->all(),
            'total' => [...$total, 'alokasi_subsidi' => (int) $trip->sum('alokasi_subsidi')],
            'kandang' => self::perKandang($periode, $total, $rekap),
        ];
    }

    /**
     * Harga kontrak untuk satu ABW: bracket dengan batas bawah terbesar yang tidak melebihi ABW itu,
     * seperti LOOKUP di lembar simulasi. Null bila ABW di bawah bracket terkecil.
     *
     * @param  Collection<int, HargaKontrak>  $bracket
     */
    public static function hargaKontrak(Collection $bracket, ?float $abw): ?int
    {
        if ($abw === null) {
            return null;
        }

        // Toleransi kecil karena batas bracket desimal (1,70) tidak selalu tepat di bilangan pecahan biner.
        return $bracket->sortBy('bobot_min_kg')->last(fn (HargaKontrak $satu): bool => $satu->bobot_min_kg <= $abw + 1e-9)?->harga_per_kg;
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
            $nilaiKontrak = $hargaKontrak !== null ? (int) round($nota->berat_kg * $hargaKontrak) : null;
            $nilaiReal = $nota->harga_real_per_kg !== null ? (int) round($nota->berat_kg * $nota->harga_real_per_kg) : null;

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

    /**
     * Bracket harga kontrak sebagai rentang ABW: sampai tepat sebelum batas bawah bracket berikutnya.
     *
     * @param  Collection<int, HargaKontrak>  $bracket
     * @return list<array{dari: float, sampai: ?float, harga: int}>
     */
    private static function bracket(Collection $bracket): array
    {
        $urut = $bracket->sortBy('bobot_min_kg')->values();

        return $urut->map(fn (HargaKontrak $satu, int $indeks): array => [
            'dari' => $satu->bobot_min_kg,
            'sampai' => isset($urut[$indeks + 1]) ? round($urut[$indeks + 1]->bobot_min_kg - 0.01, 2) : null,
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
